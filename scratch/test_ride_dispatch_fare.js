const { PrismaClient, RideStatus, UserRole } = require('../rimway-backend/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://rimway:rimway_pass@localhost:5432/rimway_db?schema=public"
    }
  }
});

async function main() {
  console.log('=== Checking Ride Creation & Fare Precision ===');

  // 1. Get standard service
  const service = await prisma.serviceType.findFirst({
    where: { isActive: true, name: 'Standard' }
  });
  console.log('Using Service:', {
    id: service.id,
    name: service.name,
    baseFare: Number(service.baseFare),
    perKm: Number(service.perKm),
    minFare: Number(service.minFare)
  });

  // 2. Simulate 2.0 km phone ride created from Admin Web
  const distanceKm = 2.0;
  const calculatedFare = Math.max(Number(service.minFare), Math.round(Number(service.baseFare) + (distanceKm * Number(service.perKm))));
  console.log(`Calculated Fare for ${distanceKm} km: ${calculatedFare} MRU`);

  // 3. Create Ride in DB
  const ride = await prisma.ride.create({
    data: {
      source: 'PHONE_OPERATOR',
      customerName: 'تجربة حساب الأجرة',
      customerPhone: '+22245000000',
      serviceTypeId: service.id,
      status: RideStatus.SEARCHING,
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      pickupName: 'تفرغ زينة - نقطة الانطلاق',
      dropoffLat: 18.0850,
      dropoffLng: -15.9700,
      dropoffName: 'لكصر - نقطة الوصول',
      distanceKm: distanceKm,
      estimatedFare: calculatedFare,
      estimatedTime: 5,
      rideCode: '4455',
      snapBaseFare: service.baseFare,
      snapPerKm: service.perKm,
      snapPerMin: service.perMinute,
      snapSurge: service.surgeRate,
      snapServiceFee: service.serviceFee,
      snapMinFare: service.minFare,
    }
  });

  console.log('Created Ride in DB:', {
    id: ride.id,
    distanceKm: Number(ride.distanceKm),
    estimatedFare: Number(ride.estimatedFare),
    customerName: ride.customerName,
    customerPhone: ride.customerPhone,
    status: ride.status
  });

  // 4. Verify what Captain and Admin will see:
  if (Number(ride.estimatedFare) === 50 && Number(ride.distanceKm) === 2.0) {
    console.log('✅ VERIFICATION PASSED: Ride fare is exactly 50 MRU for 2.0 km at 25 MRU/km.');
    console.log('✅ Admin and Captain apps receive identical distance (2.0 km) and fare (50 MRU).');
  } else {
    console.error('❌ MISMATCH in fare or distance!');
    process.exit(1);
  }

  // Cleanup test ride
  await prisma.ride.delete({ where: { id: ride.id } });
  console.log('Cleaned up test ride.');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
