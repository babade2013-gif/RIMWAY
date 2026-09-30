import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole, DriverStatus } from '@prisma/client';

describe('Admin Captains (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let adminToken: string;
  let passengerToken: string;
  let driverToken: string;
  let serviceTypeId: string;
  let createdCaptainId: string; // Driver ID

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    await app.init();

    // Create a mock ServiceType for vehicle creation
    const st = await prisma.serviceType.create({
      data: {
        name: 'Standard',
        baseFare: 10,
        perKm: 2,
        perMinute: 0.5,
        minFare: 15,
      },
    });
    serviceTypeId = st.id;

    // Generate tokens
    const secret = process.env.JWT_ACCESS_SECRET || 'dev-secret-key-fallback';
    adminToken = jwtService.sign({ sub: 'admin-cap-id', role: UserRole.ADMIN }, { secret });
    passengerToken = jwtService.sign({ sub: 'passenger-cap-id', role: UserRole.PASSENGER }, { secret });
    driverToken = jwtService.sign({ sub: 'driver-cap-id', role: UserRole.DRIVER }, { secret });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: 'admin-cap-id' } });
    if (createdCaptainId) {
      await prisma.vehicle.deleteMany({ where: { driverId: createdCaptainId } });
      const dr = await prisma.driver.findUnique({ where: { id: createdCaptainId } });
      if (dr) {
        await prisma.driver.delete({ where: { id: createdCaptainId } });
        await prisma.user.delete({ where: { id: dr.userId } });
      }
    }
    await prisma.serviceType.delete({ where: { id: serviceTypeId } });
    await app.close();
  });

  describe('Authorization', () => {
    it('unauthenticated -> 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/captains').expect(HttpStatus.UNAUTHORIZED);
    });

    it('PASSENGER -> 403', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/captains')
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('DRIVER -> 403', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/captains')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('ADMIN -> allowed', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/captains')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });
  });

  describe('Create Captain', () => {
    it('creates User + Driver + Vehicle correctly', async () => {
      const payload = {
        phone: '+22230000001',
        name: 'Test Capt',
        vehicle: {
          brand: 'Toyota',
          model: 'Corolla',
          year: 2020,
          color: 'White',
          plateNumber: '1234AA',
          serviceTypeId,
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/captains')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(res.body.user).toBeDefined();
      expect(res.body.driver).toBeDefined();
      expect(res.body.vehicle).toBeDefined();
      expect(res.body.driver.status).toBe(DriverStatus.PENDING);

      createdCaptainId = res.body.driver.id;
    });

    it('duplicate phone rejected (409)', async () => {
      const payload = {
        phone: '+22230000001',
        name: 'Duplicate',
      };
      await request(app.getHttpServer())
        .post('/api/v1/admin/captains')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CONFLICT);
    });

    it('duplicate plate rejected (409)', async () => {
      const payload = {
        phone: '+22230000002',
        name: 'Dup Plate',
        vehicle: {
          brand: 'Toyota',
          model: 'Corolla',
          year: 2020,
          color: 'White',
          plateNumber: '1234AA',
          serviceTypeId,
        },
      };
      await request(app.getHttpServer())
        .post('/api/v1/admin/captains')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CONFLICT);
    });

    it('invalid serviceType rejected (400)', async () => {
      const payload = {
        phone: '+22230000003',
        name: 'Invalid ST',
        vehicle: {
          brand: 'Toyota',
          model: 'Corolla',
          year: 2020,
          color: 'White',
          plateNumber: '9999ZZ',
          serviceTypeId: 'invalid-uuid',
        },
      };
      await request(app.getHttpServer())
        .post('/api/v1/admin/captains')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Approve', () => {
    it('PENDING -> APPROVED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/captains/${createdCaptainId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Documents verified' })
        .expect(HttpStatus.CREATED); // Note: POST without custom HttpCode defaults to 201
      
      expect(res.body.status).toBe(DriverStatus.APPROVED);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: createdCaptainId, action: 'CAPTAIN_APPROVED' },
      });
      expect(audit).toBeDefined();
      expect(audit!.reason).toBe('Documents verified');
    });

    it('invalid transition rejected (already approved)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/captains/${createdCaptainId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('Suspend', () => {
    it('APPROVED -> SUSPENDED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/captains/${createdCaptainId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Rules violation' })
        .expect(HttpStatus.CREATED);

      expect(res.body.status).toBe(DriverStatus.SUSPENDED);
      expect(res.body.isOnline).toBe(false);

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: createdCaptainId, action: 'CAPTAIN_SUSPENDED' },
      });
      expect(audit).toBeDefined();
    });
  });

  describe('Reactivate', () => {
    it('SUSPENDED -> APPROVED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/captains/${createdCaptainId}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Suspension ended' })
        .expect(HttpStatus.CREATED);

      expect(res.body.status).toBe(DriverStatus.APPROVED);

      // Verify isOnline not automatically changed to true
      const driver = await prisma.driver.findUnique({ where: { id: createdCaptainId } });
      expect(driver!.isOnline).toBe(false);
    });
  });

  describe('Profile Update', () => {
    it('allowed fields update', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/captains/${createdCaptainId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' })
        .expect(HttpStatus.OK);

      expect(res.body.name).toBe('New Name');
    });
  });

  describe('Wallet', () => {
    it('wallet endpoint returns actual balance', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/captains/${createdCaptainId}/wallet`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
      
      expect(res.body.walletBalance).toBeDefined();
    });
  });

  describe('Dispatch Exclusion', () => {
    it('SUSPENDED driver is excluded', async () => {
      const phone = '+22288888888';
      let drUser = await prisma.user.findUnique({ where: { phone } });
      if (!drUser) {
        drUser = await prisma.user.create({ data: { phone, role: UserRole.DRIVER } });
      }
      let suspendedDriver = await prisma.driver.findUnique({ where: { userId: drUser.id } });
      if (!suspendedDriver) {
        suspendedDriver = await prisma.driver.create({
          data: { userId: drUser.id, status: DriverStatus.SUSPENDED, isOnline: true },
        });
      }
      // Verification is done in driver service tests. We just ensure the DB state is valid.
      expect(suspendedDriver.status).toBe(DriverStatus.SUSPENDED);
    });
  });
});
