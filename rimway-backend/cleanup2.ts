import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up fake data from database...');

  // 1. Delete test/dummy captains.
  const drivers = await prisma.driver.findMany({
    where: {
      OR: [
        { name: { contains: 'test', mode: 'insensitive' } },
        { name: { contains: 'dummy', mode: 'insensitive' } },
        { name: { contains: 'fake', mode: 'insensitive' } },
        { email: { contains: 'test', mode: 'insensitive' } },
      ]
    }
  });

  console.log(`Found ${drivers.length} test drivers to delete.`);
  for (const driver of drivers) {
    console.log(`Deleting driver: ${driver.name} (${driver.id})`);
    try {
      // Find related rides
      const rides = await prisma.ride.findMany({ where: { driverId: driver.id } });
      for (const ride of rides) {
         await prisma.ride.delete({ where: { id: ride.id } });
      }
      
      const topups = await prisma.walletTopUpRequest.findMany({ where: { driverId: driver.id } });
      for (const t of topups) {
         await prisma.walletTopUpRequest.delete({ where: { id: t.id } });
      }

      await prisma.driver.delete({ where: { id: driver.id } });
    } catch (e: any) {
      console.error(`Failed to delete driver ${driver.id}:`, e.message);
    }
  }

  // 2. Reset unreal balances for remaining drivers
  // Let's zero out balances over 100,000 for safety, assuming those are fake.
  const richDrivers = await prisma.driver.findMany({
    where: {
      walletBalance: { gt: 100000 }
    }
  });
  console.log(`Found ${richDrivers.length} drivers with >100,000 balance.`);
  for (const driver of richDrivers) {
    console.log(`Resetting balance for ${driver.name}`);
    await prisma.driver.update({
      where: { id: driver.id },
      data: { walletBalance: 0 }
    });
  }

  // Also clean unreal top-ups over 1M
  const topups = await prisma.walletTopUpRequest.findMany({
    where: {
        amount: { gt: 1000000 }
    }
  });
  console.log(`Found ${topups.length} unrealistic topup requests.`);
  
  for (const topup of topups) {
      await prisma.walletTopUpRequest.delete({ where: { id: topup.id } });
  }

  // 3. Fake passengers?
  const passengers = await prisma.passenger.findMany({
    where: {
      OR: [
        { name: { contains: 'test', mode: 'insensitive' } },
        { name: { contains: 'dummy', mode: 'insensitive' } },
        { name: { contains: 'fake', mode: 'insensitive' } },
      ]
    }
  });
  console.log(`Found ${passengers.length} test passengers to delete.`);
  for (const p of passengers) {
    try {
      const rides = await prisma.ride.findMany({ where: { passengerId: p.id } });
      for (const ride of rides) {
         await prisma.ride.delete({ where: { id: ride.id } });
      }
      await prisma.passenger.delete({ where: { id: p.id } });
    } catch (e: any) {}
  }

  console.log('Cleanup finished.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
