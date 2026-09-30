import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';

describe('Pricing and Distance Engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let passengerToken: string;
  let serviceTypeId: string;
  let serviceType2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    await app.init();

    // Standard service type
    const st = await prisma.serviceType.create({
      data: {
        name: 'Standard Pricing Test',
        baseFare: 50,
        perKm: 10,
        perMinute: 2,
        minFare: 60,
      },
    });
    serviceTypeId = st.id;

    // Premium service type
    const st2 = await prisma.serviceType.create({
      data: {
        name: 'Premium Pricing Test',
        baseFare: 100,
        perKm: 20,
        perMinute: 5,
        minFare: 150,
      },
    });
    serviceType2Id = st2.id;

    await prisma.user.create({
      data: { id: 'passenger-pricing', phone: '+22230999999', role: UserRole.PASSENGER }
    });

    const secret = process.env.JWT_ACCESS_SECRET || 'dev-secret-key-fallback';
    adminToken = jwtService.sign({ sub: 'admin-pricing', role: UserRole.ADMIN }, { secret });
    passengerToken = jwtService.sign({ sub: 'passenger-pricing', role: UserRole.PASSENGER }, { secret });
  });

  afterAll(async () => {
    await prisma.ride.deleteMany({ where: { serviceTypeId: { in: [serviceTypeId, serviceType2Id] } } });
    await prisma.serviceType.deleteMany({ where: { id: { in: [serviceTypeId, serviceType2Id] } } });
    await prisma.user.deleteMany({ where: { id: 'passenger-pricing' } });
    await app.close();
  });

  it('Anti-Mock Test: Different coordinates give different distance and fare', async () => {
    // Short Distance (e.g. 1.1 km)
    const payloadA = {
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      dropoffLat: 18.0835, // about 1.1km north
      dropoffLng: -15.9582,
      pickupName: 'Point A',
      dropoffName: 'Point B',
      serviceTypeId,
    };
    const resA = await request(app.getHttpServer())
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send(payloadA)
      .expect(HttpStatus.CREATED); // Default POST status in NestJS
    
    // Longer Distance (e.g. 5.5 km)
    const payloadB = {
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      dropoffLat: 18.1235, // about 5.5km north
      dropoffLng: -15.9582,
      pickupName: 'Point A',
      dropoffName: 'Point B',
      serviceTypeId,
    };
    const resB = await request(app.getHttpServer())
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send(payloadB)
      .expect(HttpStatus.CREATED);

    const distA = parseFloat(resA.body.distanceKm);
    const fareA = parseFloat(resA.body.estimatedFare);

    const distB = parseFloat(resB.body.distanceKm);
    const fareB = parseFloat(resB.body.estimatedFare);

    expect(distA).toBeGreaterThan(0);
    expect(distB).toBeGreaterThan(distA);
    expect(fareB).toBeGreaterThan(fareA);
  });

  it('Case 1 & 2: Distance = 0 (same pickup/dropoff) or very short triggers minFare', async () => {
    const payload = {
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      dropoffLat: 18.0735,
      dropoffLng: -15.9582,
      pickupName: 'Point A',
      dropoffName: 'Point A',
      serviceTypeId,
    };
    const res = await request(app.getHttpServer())
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send(payload)
      .expect(HttpStatus.CREATED);
    
    const dist = parseFloat(res.body.distanceKm);
    const fare = parseFloat(res.body.estimatedFare);

    expect(dist).toBe(0);
    expect(fare).toBe(60); // baseFare is 50, distance=0, so subtotal 50, but minFare is 60.
  });

  it('Case 8: Different ServiceType gives different fare for same distance', async () => {
    const payload1 = {
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      dropoffLat: 18.1235,
      dropoffLng: -15.9582,
      pickupName: 'Point A',
      dropoffName: 'Point B',
      serviceTypeId, // Standard
    };
    const payload2 = { ...payload1, serviceTypeId: serviceType2Id }; // Premium

    const res1 = await request(app.getHttpServer())
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send(payload1)
      .expect(HttpStatus.CREATED);

    const res2 = await request(app.getHttpServer())
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send(payload2)
      .expect(HttpStatus.CREATED);
    
    const dist1 = parseFloat(res1.body.distanceKm);
    const dist2 = parseFloat(res2.body.distanceKm);
    
    expect(dist1).toBe(dist2); // same route
    expect(parseFloat(res2.body.estimatedFare)).toBeGreaterThan(parseFloat(res1.body.estimatedFare));
  });

  it('Case 9: Historical snapshot remains stable', async () => {
    // 1. Create ride using standard
    const payload = {
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      dropoffLat: 18.1235, // ~5.5 km
      dropoffLng: -15.9582,
      pickupName: 'Point A',
      dropoffName: 'Point B',
      serviceTypeId,
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/rides/request')
      .set('Authorization', `Bearer ${passengerToken}`)
      .set('Idempotency-Key', 'HIST-TEST-1')
      .send(payload)
      .expect(HttpStatus.CREATED);

    const rideId = res.body.id;
    const initialEstimatedFare = res.body.estimatedFare;

    // 2. Change the pricing of the ServiceType drastically
    await prisma.serviceType.update({
      where: { id: serviceTypeId },
      data: { baseFare: 500, perKm: 100 }
    });

    // 3. Since ride was already requested, snapBaseFare is 50, snapPerKm is 10.
    // Ensure that if we check the DB directly, snap is preserved
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    expect(parseFloat(ride.snapBaseFare as any)).toBe(50);
    expect(parseFloat(ride.snapPerKm as any)).toBe(10);
    
    // Check that estimateFare itself now returns higher
    const newEst = await request(app.getHttpServer())
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send(payload)
      .expect(HttpStatus.CREATED);
    
    expect(parseFloat(newEst.body.estimatedFare)).toBeGreaterThan(parseFloat(initialEstimatedFare));
  });
});
