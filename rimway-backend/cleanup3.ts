import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up fake data from database...');

  // 1. Delete test/dummy captains (users with DRIVER role and test names/phones)
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: 'test', mode: 'insensitive' } },
        { name: { contains: 'dummy', mode: 'insensitive' } },
        { name: { contains: 'fake', mode: 'insensitive' } },
        { phone: { contains: '12345' } },
        { phone: { contains: '00000' } }
      ]
    },
    include: {
      driverProfile: true
    }
  });

  console.log(`Found ${users.length} test users to delete.`);
  for (const user of users) {
    console.log(`Deleting user: ${user.name || user.phone} (${user.id})`);
    try {
      if (user.driverProfile) {
        const driver = user.driverProfile;
        
        const rides = await prisma.ride.findMany({ where: { driverId: driver.id } });
        for (const ride of rides) {
           await prisma.complaint.deleteMany({ where: { rideId: ride.id } });
           await prisma.walletTransaction.deleteMany({ where: { rideId: ride.id } });
           await prisma.rating.deleteMany({ where: { rideId: ride.id } });
           await prisma.ride.delete({ where: { id: ride.id } });
        }
        
        await prisma.topUpRequest.deleteMany({ where: { driverId: driver.id } });
        await prisma.walletTransaction.deleteMany({ where: { driverId: driver.id } });
        await prisma.vehicle.deleteMany({ where: { driverId: driver.id } });
        await prisma.driverDocument.deleteMany({ where: { driverId: driver.id } });
        await prisma.rating.deleteMany({ where: { driverId: driver.id } });
        
        await prisma.driver.delete({ where: { id: driver.id } });
      }

      const passengerRides = await prisma.ride.findMany({ where: { passengerId: user.id } });
      for (const ride of passengerRides) {
         await prisma.complaint.deleteMany({ where: { rideId: ride.id } });
         await prisma.walletTransaction.deleteMany({ where: { rideId: ride.id } });
         await prisma.rating.deleteMany({ where: { rideId: ride.id } });
         await prisma.ride.delete({ where: { id: ride.id } });
      }

      await prisma.savedPlace.deleteMany({ where: { passengerId: user.id } });
      await prisma.complaint.deleteMany({ where: { reporterId: user.id } });
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.rating.deleteMany({ where: { passengerId: user.id } });

      await prisma.user.delete({ where: { id: user.id } });
    } catch (e: any) {
      console.error(`Failed to delete user ${user.id}:`, e.message);
    }
  }

  // 2. Reset unreal balances for remaining drivers
  const richDrivers = await prisma.driver.findMany({
    where: {
      walletBalance: { gt: 100000 }
    }
  });
  console.log(`Found ${richDrivers.length} drivers with >100,000 balance.`);
  for (const driver of richDrivers) {
    console.log(`Resetting balance for driver ${driver.id}`);
    await prisma.driver.update({
      where: { id: driver.id },
      data: { walletBalance: 0 }
    });
  }

  // 3. Clean unrealistic top-ups
  const hugeTopups = await prisma.topUpRequest.findMany({
    where: {
        amount: { gt: 1000000 }
    }
  });
  console.log(`Found ${hugeTopups.length} unrealistic topup requests.`);
  
  for (const topup of hugeTopups) {
      await prisma.topUpRequest.delete({ where: { id: topup.id } });
  }

  console.log('Cleanup finished.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
