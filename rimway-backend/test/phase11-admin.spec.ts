import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole, DriverStatus, RideStatus, RideSource } from '@prisma/client';
import { DriverService } from '../src/drivers/driver.service';

describe('Phase 11 Admin Extensions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let driverService: DriverService;

  let adminToken: string;
  let passengerToken: string;
  let passengerId: string;
  let driverId: string;
  let driverUserId: string;
  let serviceTypeId: string;
  let rideId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    driverService = app.get(DriverService);

    await app.init();

    const secret = process.env.JWT_ACCESS_SECRET || 'super-secret-change-me-in-production';
    adminToken = jwtService.sign({ sub: 'phase11-admin', role: UserRole.ADMIN }, { secret });

    // Create passenger
    const pUser = await prisma.user.create({
      data: {
        phone: '+22239999991',
        name: 'Phase 11 Passenger',
        role: UserRole.PASSENGER,
      },
    });
    passengerId = pUser.id;
    passengerToken = jwtService.sign({ sub: passengerId, role: UserRole.PASSENGER }, { secret });

    // Create service type
    const st = await prisma.serviceType.create({
      data: {
        name: 'Phase11_Service',
        baseFare: 20,
        perKm: 5,
        perMinute: 1,
        minFare: 25,
        version: 1,
      },
    });
    serviceTypeId = st.id;

    // Create driver
    const dUser = await prisma.user.create({
      data: {
        phone: '+22239999992',
        name: 'Phase 11 Driver',
        role: UserRole.DRIVER,
      },
    });
    driverUserId = dUser.id;

    const dr = await prisma.driver.create({
      data: {
        userId: driverUserId,
        status: DriverStatus.APPROVED,
        isOnline: true,
        priorityTier: 'NORMAL',
        rating: 5.0,
      },
    });
    driverId = dr.id;

    // Create a completed ride
    const ride = await prisma.ride.create({
      data: {
        passengerId,
        driverId,
        serviceTypeId,
        pickupLat: 18.0735,
        pickupLng: -15.9582,
        pickupName: 'Pickup Point',
        dropoffLat: 18.0800,
        dropoffLng: -15.9500,
        dropoffName: 'Dropoff Point',
        source: RideSource.PASSENGER_APP,
        status: RideStatus.COMPLETED,
        rideCode: '1111',
        snapBaseFare: 20,
        snapPerKm: 5,
        snapPerMin: 1,
        snapSurge: 1.0,
        snapServiceFee: 10,
        finalFare: 50,
      },
    });
    rideId = ride.id;
  });

  afterAll(async () => {
    await prisma.rating.deleteMany({ where: { driverId } });
    await prisma.driverDocument.deleteMany({ where: { driverId } });
    await prisma.complaint.deleteMany({ where: { rideId } });
    await prisma.ride.deleteMany({ where: { id: rideId } });
    await prisma.driver.deleteMany({ where: { id: driverId } });
    await prisma.user.deleteMany({ where: { id: { in: [passengerId, driverUserId] } } });
    await prisma.serviceType.deleteMany({ where: { id: serviceTypeId } });
    await prisma.auditLog.deleteMany({ where: { userId: 'phase11-admin' } });
    await app.close();
  });

  describe('1. Captain Priority Tier', () => {
    it('Admin can update priority tier to PREFERRED and logs audit', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/captains/${driverId}/priority`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priorityTier: 'PREFERRED', reason: 'High rating' });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.priorityTier).toBe('PREFERRED');

      const updated = await prisma.driver.findUnique({ where: { id: driverId } });
      expect(updated?.priorityTier).toBe('PREFERRED');

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'CAPTAIN_PRIORITY_UPDATED', entityId: driverId },
      });
      expect(audit).toBeDefined();
      expect(audit?.userId).toBe('phase11-admin');
    });

    it('Rejects invalid priority tier', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/captains/${driverId}/priority`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priorityTier: 'SUPER_VIP' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('2. Rating Contract', () => {
    it('Passenger can rate a completed ride (1..5) and aggregates driver rating', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${rideId}/rate`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ rating: 4, comment: 'Great driver!' });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.rating).toBe(4);
      expect(res.body.driverId).toBe(driverId);

      const driver = await prisma.driver.findUnique({ where: { id: driverId } });
      expect(Number(driver?.rating)).toBe(4);
    });

    it('Rejects duplicate rating for the same ride', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${rideId}/rate`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ rating: 5 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('Rejects rating < 1 or > 5', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${rideId}/rate`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ rating: 6 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('Admin can view ratings read-only', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/ratings/drivers/${driverId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].rating).toBe(4);
    });
  });

  describe('3. Documents Metadata Management', () => {
    let docId: string;

    it('Admin can create driver document metadata', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          driverId,
          type: 'DRIVING_LICENSE',
          fileName: 'license.pdf',
          fileUrl: 'https://storage.rimway.mr/docs/license.pdf',
          mimeType: 'application/pdf',
          status: 'PENDING',
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PENDING');
      docId = res.body.id;
    });

    it('Admin can list driver documents', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/documents/drivers/${driverId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(docId);
    });

    it('Admin can update document verification status', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/admin/documents/${docId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED', verifiedBy: 'phase11-admin' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.status).toBe('APPROVED');
      expect(res.body.verifiedBy).toBe('phase11-admin');
    });
  });

  describe('4. Dashboard Stats', () => {
    it('Admin can fetch dashboard metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.todayRides).toBeDefined();
      expect(res.body.completedRides).toBeDefined();
      expect(res.body.cancelledRides).toBeDefined();
      expect(res.body.onlineCaptains).toBeDefined();
      expect(res.body.availableCaptains).toBeDefined();
      expect(res.body.grossFare).toBeDefined();
      expect(res.body.commission).toBeDefined();
      expect(res.body.netEarnings).toBeDefined();
    });
  });

  describe('5. Pricing Optimistic Concurrency', () => {
    it('Admin can list pricing service types', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/pricing/service-types')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Admin can update pricing with matching version', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/admin/pricing/service-types/${serviceTypeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseFare: 25,
          perKm: 6,
          version: 1,
        });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.version).toBe(2);
      expect(Number(res.body.baseFare)).toBe(25);
    });

    it('Rejects update with stale version (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/admin/pricing/service-types/${serviceTypeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseFare: 30,
          version: 1, // Stale version, current is 2
        });

      expect(res.status).toBe(HttpStatus.CONFLICT);
    });
  });

  describe('6. Complaints Management', () => {
    let complaintId: string;

    beforeAll(async () => {
      const comp = await prisma.complaint.create({
        data: {
          rideId,
          reporterId: passengerId,
          subject: 'Driver route deviation',
          description: 'The driver took a longer route',
          status: 'OPEN',
        },
      });
      complaintId = comp.id;
    });

    it('Admin can list complaints', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/complaints')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('Admin can update complaint status and logs audit', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/admin/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.status).toBe('RESOLVED');

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'UPDATE_COMPLAINT_STATUS', entityId: complaintId },
      });
      expect(audit).toBeDefined();
    });
  });

  describe('7. Activity Audit Log (Read-only)', () => {
    it('Admin can list audit logs paginated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/audit?skip=0&take=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
