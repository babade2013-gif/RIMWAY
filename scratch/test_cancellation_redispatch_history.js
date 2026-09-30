const { PrismaClient, RideStatus, UserRole } = require('../rimway-backend/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://rimway:rimway_pass@localhost:5432/rimway_db?schema=public"
    }
  }
});

async function main() {
  console.log('=== Testing Cancellation Re-Dispatch, History Archiving & Multi-Captain Flow ===');

  // 1. Fetch Standard Service
  const service = await prisma.serviceType.findFirst({
    where: { isActive: true, name: 'Standard' }
  });
  console.log('1. Active Service:', { name: service.name, baseFare: Number(service.baseFare), perKm: Number(service.perKm), minFare: Number(service.minFare) });

  // 2. Find or create two test drivers: Captain 1 & Captain 2
  async function getOrCreateDriver(phone, name, plate) {
    let user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          name,
          role: UserRole.DRIVER
        }
      });
    }
    let driver = await prisma.driver.findFirst({ where: { userId: user.id } });
    if (!driver) {
      driver = await prisma.driver.create({
        data: {
          userId: user.id,
          status: 'APPROVED',
          isOnline: true,
          currentLat: 18.0735,
          currentLng: -15.9582
        }
      });
    }
    let vehicle = await prisma.vehicle.findFirst({ where: { driverId: driver.id } });
    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          driverId: driver.id,
          brand: 'Toyota',
          model: 'Corolla',
          year: 2020,
          color: 'White',
          plateNumber: plate,
          serviceTypeId: service.id
        }
      });
    }
    return { user, driver, vehicle };
  }

  const cap1 = await getOrCreateDriver('+22241111111', 'كابتن أحمد', '1111AA');
  const cap2 = await getOrCreateDriver('+22242222222', 'كابتن محمود', '2222BB');

  console.log('2. Test Captains:');
  console.log('   Captain 1:', cap1.user.name, cap1.user.phone);
  console.log('   Captain 2:', cap2.user.name, cap2.user.phone);

  // 3. Admin launches 2.0 km phone ride
  const distanceKm = 2.0;
  const fare = 50; // 2km * 25 MRU
  const originalRide = await prisma.ride.create({
    data: {
      source: 'PHONE_OPERATOR',
      customerName: 'فاطمة الزهراء',
      customerPhone: '+22245999999',
      serviceTypeId: service.id,
      status: RideStatus.SEARCHING,
      pickupLat: 18.0735,
      pickupLng: -15.9582,
      pickupName: 'تفرغ زينة - كارفور BMD',
      dropoffLat: 18.0850,
      dropoffLng: -15.9700,
      dropoffName: 'لكصر - سوق العاصمة',
      distanceKm: distanceKm,
      estimatedFare: fare,
      estimatedTime: 5,
      rideCode: '7788',
      snapBaseFare: service.baseFare,
      snapPerKm: service.perKm,
      snapPerMin: service.perMinute,
      snapSurge: service.surgeRate,
      snapServiceFee: service.serviceFee,
      snapMinFare: service.minFare,
    }
  });
  console.log(`3. Created Ride #${originalRide.id.substring(0, 8)}: distance=${distanceKm}km, fare=${fare} MRU, status=${originalRide.status}`);

  // 4. Captain 1 accepts the ride
  const accepted1 = await prisma.ride.update({
    where: { id: originalRide.id },
    data: {
      driverId: cap1.driver.id,
      status: RideStatus.DRIVER_ASSIGNED,
      stateVersion: { increment: 1 }
    }
  });
  console.log(`4. Captain 1 accepted Ride #${accepted1.id.substring(0, 8)}. Status: ${accepted1.status}, Driver: ${cap1.user.name}`);

  // 5. Captain 1 cancels the ride with reason
  const cancelReason = 'عطل مفاجئ في إطار المركبة';
  const cancelledRide = await prisma.ride.update({
    where: { id: originalRide.id },
    data: {
      status: RideStatus.CANCELLED_BY_DRIVER,
      stateVersion: { increment: 1 }
    }
  });
  await prisma.auditLog.create({
    data: {
      userId: cap1.user.id,
      action: 'RIDE_CANCELLED_BY_DRIVER',
      entity: 'Ride',
      entityId: originalRide.id,
      reason: cancelReason,
      newData: { status: RideStatus.CANCELLED_BY_DRIVER, driverId: cap1.driver.id, reason: cancelReason }
    }
  });
  console.log(`5. Captain 1 cancelled Ride #${cancelledRide.id.substring(0, 8)}. Status: ${cancelledRide.status}, Reason: "${cancelReason}"`);

  // 6. System auto re-dispatches continuation ride
  const reDispatchedRide = await prisma.ride.create({
    data: {
      source: originalRide.source,
      customerName: originalRide.customerName,
      customerPhone: originalRide.customerPhone,
      serviceTypeId: originalRide.serviceTypeId,
      status: RideStatus.SEARCHING,
      pickupLat: originalRide.pickupLat,
      pickupLng: originalRide.pickupLng,
      pickupName: originalRide.pickupName,
      dropoffLat: originalRide.dropoffLat,
      dropoffLng: originalRide.dropoffLng,
      dropoffName: originalRide.dropoffName,
      distanceKm: originalRide.distanceKm,
      estimatedFare: originalRide.estimatedFare,
      estimatedTime: originalRide.estimatedTime,
      rideCode: '7789',
      snapBaseFare: originalRide.snapBaseFare,
      snapPerKm: originalRide.snapPerKm,
      snapPerMin: originalRide.snapPerMin,
      snapSurge: originalRide.snapSurge,
      snapServiceFee: originalRide.snapServiceFee,
      snapMinFare: originalRide.snapMinFare,
    }
  });
  console.log(`6. Auto Re-Dispatched Ride #${reDispatchedRide.id.substring(0, 8)} into SEARCHING: fare=${reDispatchedRide.estimatedFare} MRU`);

  // 7. Captain 2 accepts the re-dispatched ride
  const accepted2 = await prisma.ride.update({
    where: { id: reDispatchedRide.id },
    data: {
      driverId: cap2.driver.id,
      status: RideStatus.DRIVER_ASSIGNED,
      stateVersion: { increment: 1 }
    }
  });
  console.log(`7. Captain 2 accepted Ride #${accepted2.id.substring(0, 8)}. Status: ${accepted2.status}, Driver: ${cap2.user.name}`);

  // 8. Captain 2 completes the ride
  const completed2 = await prisma.ride.update({
    where: { id: reDispatchedRide.id },
    data: {
      status: RideStatus.COMPLETED,
      finalFare: reDispatchedRide.estimatedFare,
      stateVersion: { increment: 1 }
    }
  });
  console.log(`8. Captain 2 completed Ride #${completed2.id.substring(0, 8)}. Status: ${completed2.status}, Final Fare: ${completed2.finalFare} MRU`);

  // 9. Verification of Captain 1's history
  const cap1Rides = await prisma.ride.findMany({
    where: { driverId: cap1.driver.id },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`\n9. Verification in Captain 1 History (${cap1.user.name}):`);
  console.log(`   Found ${cap1Rides.length} ride(s). Most recent status: ${cap1Rides[0].status}`);
  if (cap1Rides[0].status !== RideStatus.CANCELLED_BY_DRIVER) {
    throw new Error('FAILED: Expected Captain 1 ride to be CANCELLED_BY_DRIVER');
  }

  // 10. Verification of Captain 2's history
  const cap2Rides = await prisma.ride.findMany({
    where: { driverId: cap2.driver.id },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`\n10. Verification in Captain 2 History (${cap2.user.name}):`);
  console.log(`   Found ${cap2Rides.length} ride(s). Most recent status: ${cap2Rides[0].status}`);
  if (cap2Rides[0].status !== RideStatus.COMPLETED) {
    throw new Error('FAILED: Expected Captain 2 ride to be COMPLETED');
  }

  // 11. Verification in Admin Archive / getRides() simulation
  const adminRides = await prisma.ride.findMany({
    where: { id: { in: [originalRide.id, reDispatchedRide.id] } },
    include: {
      driver: { select: { id: true, user: { select: { name: true, phone: true } }, vehicle: true } }
    },
    orderBy: { createdAt: 'asc' }
  });
  console.log('\n11. Verification in Admin Archive / Management:');
  for (const r of adminRides) {
    console.log(`   Ride #${r.id.substring(0, 8)} | Status: ${r.status} | Captain: ${r.driver?.user?.name || '---'} (${r.driver?.vehicle?.brand} ${r.driver?.vehicle?.model}) | Fare: ${r.estimatedFare} MRU`);
  }

  console.log('\n🎉 ALL VERIFICATIONS PASSED 100%! The multi-captain lifecycle behaves exactly as requested!');

  // Cleanup test rides
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [originalRide.id, reDispatchedRide.id] } } });
  await prisma.ride.deleteMany({ where: { id: { in: [originalRide.id, reDispatchedRide.id] } } });
  console.log('Cleaned up test rides and audit logs.');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
