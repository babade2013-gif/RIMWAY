import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole, RideStatus, RideSource } from '@prisma/client';

describe('Admin Endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let passengerToken: string;
  let serviceTypeId: string;
  let createdRideId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // Create ServiceType
    const st = await prisma.serviceType.create({
      data: {
        name: 'Standard Admin Test',
        baseFare: 50,
        perKm: 10,
        perMinute: 2,
        minFare: 100,
        isActive: true,
      }
    });
    serviceTypeId = st.id;

    // Generate tokens
    adminToken = jwtService.sign({ sub: 'admin-id-1', role: UserRole.ADMIN }, { secret: process.env.JWT_ACCESS_SECRET || 'dev-secret-key-fallback' });
    passengerToken = jwtService.sign({ sub: 'passenger-id-1', role: UserRole.PASSENGER }, { secret: process.env.JWT_ACCESS_SECRET || 'dev-secret-key-fallback' });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: 'admin-id-1' } });
    await prisma.ride.deleteMany({ where: { serviceTypeId } });
    await prisma.serviceType.delete({ where: { id: serviceTypeId } });
    await app.close();
  });

  describe('Authorization', () => {
    it('should reject unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/rides')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should reject PASSENGER role', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/rides')
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should allow ADMIN role', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/rides')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });
  });

  describe('Phone Ride Creation & Monitoring', () => {
    it('Admin can create phone ride', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/rides')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerName: 'Test Customer',
          customerPhone: '+22211111111',
          pickupLat: 18.0,
          pickupLng: -15.0,
          pickupName: 'Pickup Point',
          dropoffLat: 18.1,
          dropoffLng: -15.1,
          dropoffName: 'Dropoff Point',
          serviceTypeId,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.source).toBe(RideSource.PHONE_OPERATOR);
      expect(res.body.customerName).toBe('Test Customer');
      expect(res.body.status).toBe(RideStatus.SEARCHING);
      expect(res.body.passengerId).toBeNull();
      createdRideId = res.body.id;
    });

    it('Admin can read ride detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/rides/${createdRideId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
      
      expect(res.body.id).toBe(createdRideId);
      expect(res.body.customerPhone).toBe('+22211111111');
    });
  });

  describe('Admin Cancellation', () => {
    it('SEARCHING -> CANCELLED_BY_ADMIN', async () => {
      const ride = await prisma.ride.findUnique({ where: { id: createdRideId } });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/rides/${createdRideId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stateVersion: ride!.stateVersion,
          reason: 'Customer requested cancellation via phone'
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.status).toBe(RideStatus.CANCELLED_BY_ADMIN);

      // Verify Audit Log
      const audit = await prisma.auditLog.findFirst({ where: { entityId: createdRideId }, orderBy: { createdAt: 'desc' } });
      expect(audit).toBeDefined();
      expect(audit!.action).toBe('ADMIN_RIDE_CANCELLED');
    });

    it('stale stateVersion -> 409', async () => {
      const r = await prisma.ride.create({
        data: {
          source: 'PHONE_OPERATOR',
          customerName: 'Conflict Test',
          serviceTypeId,
          status: RideStatus.SEARCHING,
          pickupLat: 18, pickupLng: -15, pickupName: 'A',
          dropoffLat: 18, dropoffLng: -15, dropoffName: 'B',
          snapBaseFare: 50, snapPerKm: 10, snapPerMin: 2, snapSurge: 1, snapServiceFee: 0,
          rideCode: '1234'
        }
      });
      await request(app.getHttpServer())
        .post(`/api/v1/admin/rides/${r.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateVersion: 999 }) // Stale version
        .expect(HttpStatus.CONFLICT);
    });
  });
});
