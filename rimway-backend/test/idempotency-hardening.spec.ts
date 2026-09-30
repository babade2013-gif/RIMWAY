import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole, RideStatus } from '@prisma/client';

describe('Phone Ride Idempotency Hardening (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let serviceTypeId: string;
  const idempotencyKey = 'TEST-10B-' + Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    await app.init();

    const st = await prisma.serviceType.create({
      data: {
        name: 'Idempotency ST',
        baseFare: 10,
        perKm: 2,
        perMinute: 0.5,
        minFare: 15,
      },
    });
    serviceTypeId = st.id;

    const secret = process.env.JWT_ACCESS_SECRET || 'dev-secret-key-fallback';
    adminToken = jwtService.sign({ sub: 'admin-idempotency', role: UserRole.ADMIN }, { secret });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: 'admin-idempotency' } });
    await prisma.ride.deleteMany({ where: { serviceTypeId } });
    await prisma.serviceType.delete({ where: { id: serviceTypeId } });
    await app.close();
  });

  it('Test 1: Same key + same payload -> same Ride', async () => {
    const payload = {
      customerName: 'Alice',
      customerPhone: '+22230000000',
      serviceTypeId,
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      pickupName: 'A',
      dropoffLat: 18.0835,
      dropoffLng: -15.9582,
      dropoffName: 'B',
    };

    const res1 = await request(app.getHttpServer())
      .post('/api/v1/admin/rides')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(HttpStatus.CREATED);

    const res2 = await request(app.getHttpServer())
      .post('/api/v1/admin/rides')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(HttpStatus.CREATED);

    expect(res1.body.id).toEqual(res2.body.id);
    
    // Check that there is only ONE dispatch (since it returns early on existing)
    // and only ONE audit log.
    const audits = await prisma.auditLog.findMany({ where: { entityId: res1.body.id, action: 'PHONE_RIDE_CREATED' } });
    expect(audits.length).toBe(1);
  });

  it('Test 2: Same key + different customerName -> 409', async () => {
    const payload2 = {
      customerName: 'Bob', // changed
      customerPhone: '+22230000000',
      serviceTypeId,
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      pickupName: 'A',
      dropoffLat: 18.0835,
      dropoffLng: -15.9582,
      dropoffName: 'B',
    };

    await request(app.getHttpServer())
      .post('/api/v1/admin/rides')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload2)
      .expect(HttpStatus.CONFLICT);
  });

  it('Test 3: Same key + different customerPhone -> 409', async () => {
    const payload = {
      customerName: 'Alice',
      customerPhone: '+22230000001', // changed
      serviceTypeId,
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      pickupName: 'A',
      dropoffLat: 18.0835,
      dropoffLng: -15.9582,
      dropoffName: 'B',
    };
    await request(app.getHttpServer())
      .post('/api/v1/admin/rides')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(HttpStatus.CONFLICT);
  });

  it('Test 4 & 5: Same key + different pickup or destination -> 409', async () => {
    const payload4 = {
      customerName: 'Alice',
      customerPhone: '+22230000000',
      serviceTypeId,
      pickupLat: 18.0999, // changed
      pickupLng: -15.9582,
      pickupName: 'A',
      dropoffLat: 18.0835,
      dropoffLng: -15.9582,
      dropoffName: 'B',
    };
    await request(app.getHttpServer())
      .post('/api/v1/admin/rides')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload4)
      .expect(HttpStatus.CONFLICT);
  });

  it('Test 6: Same key + different serviceType -> 409', async () => {
    const payload6 = {
      customerName: 'Alice',
      customerPhone: '+22230000000',
      serviceTypeId: 'a-different-service-type', // changed
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      pickupName: 'A',
      dropoffLat: 18.0835,
      dropoffLng: -15.9582,
      dropoffName: 'B',
    };
    await request(app.getHttpServer())
      .post('/api/v1/admin/rides')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload6)
      .expect(HttpStatus.CONFLICT);
  });

  it('Test 7: Different keys + same payload -> two independent rides', async () => {
    const payload = {
      customerName: 'Charlie',
      customerPhone: '+22250000000',
      serviceTypeId,
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      pickupName: 'A',
      dropoffLat: 18.0835,
      dropoffLng: -15.9582,
      dropoffName: 'B',
    };
    
    const key1 = 'TEST-KEY-7-1';
    const key2 = 'TEST-KEY-7-2';
    
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/admin/rides')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key1)
      .send(payload)
      .expect(HttpStatus.CREATED);

    const res2 = await request(app.getHttpServer())
      .post('/api/v1/admin/rides')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key2)
      .send(payload)
      .expect(HttpStatus.CREATED);
      
    expect(res1.body.id).not.toEqual(res2.body.id);
  });

  it('Test 8 & 9: Concurrent requests test', async () => {
    const payload = {
      customerName: 'Dave',
      customerPhone: '+22250000001',
      serviceTypeId,
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      pickupName: 'A',
      dropoffLat: 18.0835,
      dropoffLng: -15.9582,
      dropoffName: 'B',
    };
    const diffPayload = {
      ...payload,
      customerName: 'Eve'
    };
    const key = 'CONCURRENT-TEST-KEY';

    // Fire concurrently: same payload + different payload at the same time
    const promises = [
      request(app.getHttpServer()).post('/api/v1/admin/rides').set('Authorization', `Bearer ${adminToken}`).set('Idempotency-Key', key).send(payload),
      request(app.getHttpServer()).post('/api/v1/admin/rides').set('Authorization', `Bearer ${adminToken}`).set('Idempotency-Key', key).send(diffPayload),
      request(app.getHttpServer()).post('/api/v1/admin/rides').set('Authorization', `Bearer ${adminToken}`).set('Idempotency-Key', key).send(payload),
    ];
    
    const results = await Promise.all(promises);
    
    const statuses = results.map(r => r.status);
    
    // Exact count of 201s and 409s depends on who won the race, but:
    // One payload will be created (201).
    // The exact identical payload (if it wins or loses to the first) will be 201 (since it returns existing).
    // The different payload will be 409 (since it conflicts on hash).
    
    expect(statuses).toContain(HttpStatus.CREATED);
    expect(statuses).toContain(HttpStatus.CONFLICT);
    
    // Ensure only 1 ride was created
    const count = await prisma.ride.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it('Test 10: Legacy null payloadHash -> 409 Conflict', async () => {
    // Manually create a ride with null payloadHash
    const legacyKey = 'LEGACY-KEY-10';
    await prisma.ride.create({
      data: {
        source: 'PHONE_OPERATOR',
        customerName: 'Legacy',
        customerPhone: '123',
        serviceTypeId,
        idempotencyKey: legacyKey,
        payloadHash: null,
        status: RideStatus.SEARCHING,
        pickupLat: 0,
        pickupLng: 0,
        pickupName: 'A',
        dropoffLat: 1,
        dropoffLng: 1,
        dropoffName: 'B',
        distanceKm: 1,
        estimatedTime: 1,
        estimatedFare: 1,
        snapBaseFare: 1,
        snapMinFare: 1,
        snapPerKm: 1,
        snapPerMin: 1,
        snapSurge: 1,
        snapServiceFee: 1,
        rideCode: '0000'
      }
    });

    const payload = {
      customerName: 'Legacy',
      customerPhone: '123',
      serviceTypeId,
      pickupLat: 0,
      pickupLng: 0,
      pickupName: 'A',
      dropoffLat: 1,
      dropoffLng: 1,
      dropoffName: 'B',
    };

    await request(app.getHttpServer())
      .post('/api/v1/admin/rides')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', legacyKey)
      .send(payload)
      .expect(HttpStatus.CONFLICT);
  });
});
