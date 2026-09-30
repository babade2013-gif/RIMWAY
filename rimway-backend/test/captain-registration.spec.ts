import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole, DriverStatus } from '@prisma/client';

describe('Captain Registration & Review Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let adminToken: string;
  let driverToken: string;
  let driverUserId: string;
  let driverId: string;
  let serviceTypeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    await app.init();

    // Find or create ServiceType
    const existingSt = await prisma.serviceType.findFirst({ where: { isActive: true } });
    if (existingSt) {
      serviceTypeId = existingSt.id;
    } else {
      const st = await prisma.serviceType.create({
        data: {
          name: 'Standard-RegTest',
          baseFare: 0,
          perKm: 25,
          perMinute: 0,
          minFare: 50,
        },
      });
      serviceTypeId = st.id;
    }

    // Clean up potential existing user or use unique phone
    const testPhone = '+2223' + Math.floor(1000000 + Math.random() * 9000000);

    const driverUser = await prisma.user.create({
      data: {
        phone: testPhone,
        role: UserRole.DRIVER,
      },
    });
    driverUserId = driverUser.id;

    const driverProfile = await prisma.driver.create({
      data: {
        userId: driverUserId,
        status: DriverStatus.PENDING,
      },
    });
    driverId = driverProfile.id;

    const secret = process.env.JWT_ACCESS_SECRET || 'dev-secret-key-fallback';
    adminToken = jwtService.sign({ sub: 'admin-test-id', role: UserRole.ADMIN }, { secret });
    driverToken = jwtService.sign({ sub: driverUserId, role: UserRole.DRIVER, driverId }, { secret });
  });

  afterAll(async () => {
    if (driverUserId) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: [driverUserId, 'admin-test-id'] } } });
      await prisma.driverDocument.deleteMany({ where: { driverId } });
      await prisma.vehicle.deleteMany({ where: { driverId } });
      await prisma.driver.deleteMany({ where: { id: driverId } });
      await prisma.user.deleteMany({ where: { id: driverUserId } });
    }
    await app.close();
  });

  it('Step 1: GET /api/v1/drivers/me returns REGISTRATION_INCOMPLETE for a new driver without vehicle/docs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/drivers/me')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.registrationStatus).toBe('REGISTRATION_INCOMPLETE');
    expect(res.body.status).toBe('PENDING');
  });

  it('Step 2: POST /api/v1/drivers/register fails if required documents are missing', async () => {
    const incompletePayload = {
      name: 'Test Captain',
      vehicle: {
        brand: 'Toyota',
        model: 'Corolla',
        year: 2021,
        color: 'White',
        plateNumber: '4455AA01',
        serviceTypeId,
      },
      documents: [
        { type: 'NATIONAL_ID', fileUrl: '/uploads/documents/id.jpg', fileName: 'id.jpg', mimeType: 'image/jpeg' },
        // Missing DRIVING_LICENSE, VEHICLE_INSURANCE, VEHICLE_REGISTRATION
      ],
      vehiclePhotos: [
        { type: 'VEHICLE_FRONT', fileUrl: '/uploads/vehicles/f.jpg', fileName: 'f.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_BACK', fileUrl: '/uploads/vehicles/b.jpg', fileName: 'b.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_RIGHT', fileUrl: '/uploads/vehicles/r.jpg', fileName: 'r.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_LEFT', fileUrl: '/uploads/vehicles/l.jpg', fileName: 'l.jpg', mimeType: 'image/jpeg' },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/drivers/register')
      .set('Authorization', `Bearer ${driverToken}`)
      .send(incompletePayload)
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body.message).toBeDefined();
  });

  it('Step 3: POST /api/v1/drivers/register fails if 4 vehicle photos are missing', async () => {
    const incompletePhotos = {
      name: 'Test Captain',
      vehicle: {
        brand: 'Toyota',
        model: 'Corolla',
        year: 2021,
        color: 'White',
        plateNumber: '4455AA01',
        serviceTypeId,
      },
      documents: [
        { type: 'NATIONAL_ID', fileUrl: '/uploads/documents/id.jpg', fileName: 'id.jpg', mimeType: 'image/jpeg' },
        { type: 'DRIVING_LICENSE', fileUrl: '/uploads/documents/lic.jpg', fileName: 'lic.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_INSURANCE', fileUrl: '/uploads/documents/ins.jpg', fileName: 'ins.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_REGISTRATION', fileUrl: '/uploads/documents/reg.jpg', fileName: 'reg.jpg', mimeType: 'image/jpeg' },
      ],
      vehiclePhotos: [
        { type: 'VEHICLE_FRONT', fileUrl: '/uploads/vehicles/f.jpg', fileName: 'f.jpg', mimeType: 'image/jpeg' },
        // Missing BACK, RIGHT, LEFT
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/drivers/register')
      .set('Authorization', `Bearer ${driverToken}`)
      .send(incompletePhotos)
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body.message).toBeDefined();
  });

  it('Step 4: POST /api/v1/drivers/register succeeds with complete documents and 4 vehicle photos', async () => {
    const validPayload = {
      name: 'Mohamed Salem',
      photo: '/uploads/documents/profile.jpg',
      vehicle: {
        brand: 'Toyota',
        model: 'Avensis',
        year: 2020,
        color: 'Silver',
        plateNumber: '9988AA00',
        serviceTypeId,
      },
      documents: [
        { type: 'NATIONAL_ID', fileUrl: '/uploads/documents/id.jpg', fileName: 'id.jpg', mimeType: 'image/jpeg' },
        { type: 'DRIVING_LICENSE', fileUrl: '/uploads/documents/lic.jpg', fileName: 'lic.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_INSURANCE', fileUrl: '/uploads/documents/ins.jpg', fileName: 'ins.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_REGISTRATION', fileUrl: '/uploads/documents/reg.jpg', fileName: 'reg.jpg', mimeType: 'image/jpeg' },
      ],
      vehiclePhotos: [
        { type: 'VEHICLE_FRONT', fileUrl: '/uploads/vehicles/front.jpg', fileName: 'front.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_BACK', fileUrl: '/uploads/vehicles/back.jpg', fileName: 'back.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_RIGHT', fileUrl: '/uploads/vehicles/right.jpg', fileName: 'right.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_LEFT', fileUrl: '/uploads/vehicles/left.jpg', fileName: 'left.jpg', mimeType: 'image/jpeg' },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/drivers/register')
      .set('Authorization', `Bearer ${driverToken}`)
      .send(validPayload)
      .expect(HttpStatus.CREATED);

    expect(res.body.registrationStatus).toBe('PENDING_REVIEW');
    expect(res.body.vehicle.plateNumber).toBe('9988AA00');
    expect(res.body.documents.length).toBe(8);
  });

  it('Step 5: GET /api/v1/drivers/me now returns PENDING_REVIEW', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/drivers/me')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.registrationStatus).toBe('PENDING_REVIEW');
    expect(res.body.status).toBe('PENDING');
  });

  it('Step 6: Admin rejects with mandatory reason', async () => {
    // Fails if reason is empty
    await request(app.getHttpServer())
      .post(`/api/v1/admin/captains/${driverId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '' })
      .expect(HttpStatus.BAD_REQUEST);

    // Succeeds with reason
    const reason = 'صورة رخصة السياقة غير واضحة يرجى إعادة رفعها بدقة';
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/captains/${driverId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason })
      .expect(HttpStatus.CREATED);

    expect(res.body.status).toBe('REJECTED');
    expect(res.body.rejectionReason).toBe(reason);

    // Driver gets REJECTED status with reason
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/drivers/me')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(HttpStatus.OK);

    expect(meRes.body.registrationStatus).toBe('REJECTED');
    expect(meRes.body.rejectionReason).toBe(reason);
  });

  it('Step 7: Driver resubmits after fixing issue -> status resets to PENDING_REVIEW', async () => {
    const resubmitPayload = {
      name: 'Mohamed Salem',
      vehicle: {
        brand: 'Toyota',
        model: 'Avensis',
        year: 2020,
        color: 'Silver',
        plateNumber: '9988AA00',
        serviceTypeId,
      },
      documents: [
        { type: 'NATIONAL_ID', fileUrl: '/uploads/documents/id.jpg', fileName: 'id.jpg', mimeType: 'image/jpeg' },
        { type: 'DRIVING_LICENSE', fileUrl: '/uploads/documents/lic_fixed.jpg', fileName: 'lic_fixed.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_INSURANCE', fileUrl: '/uploads/documents/ins.jpg', fileName: 'ins.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_REGISTRATION', fileUrl: '/uploads/documents/reg.jpg', fileName: 'reg.jpg', mimeType: 'image/jpeg' },
      ],
      vehiclePhotos: [
        { type: 'VEHICLE_FRONT', fileUrl: '/uploads/vehicles/front.jpg', fileName: 'front.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_BACK', fileUrl: '/uploads/vehicles/back.jpg', fileName: 'back.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_RIGHT', fileUrl: '/uploads/vehicles/right.jpg', fileName: 'right.jpg', mimeType: 'image/jpeg' },
        { type: 'VEHICLE_LEFT', fileUrl: '/uploads/vehicles/left.jpg', fileName: 'left.jpg', mimeType: 'image/jpeg' },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/drivers/register')
      .set('Authorization', `Bearer ${driverToken}`)
      .send(resubmitPayload)
      .expect(HttpStatus.CREATED);

    expect(res.body.registrationStatus).toBe('PENDING_REVIEW');
    expect(res.body.rejectionReason).toBeNull();
  });

  it('Step 8: Admin approves captain -> status becomes APPROVED, rejectionReason null', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/captains/${driverId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'All documents verified successfully' })
      .expect(HttpStatus.CREATED);

    expect(res.body.status).toBe('APPROVED');

    // Driver me now returns APPROVED
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/drivers/me')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(HttpStatus.OK);

    expect(meRes.body.registrationStatus).toBe('APPROVED');
    expect(meRes.body.status).toBe('APPROVED');
  });
});
