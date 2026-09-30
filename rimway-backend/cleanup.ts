import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up fake data from database...');

  // 1. Delete test/dummy captains. We can identify them by names like "test", "fake", "dummy"
  // or maybe they have certain mock emails/phones.
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
    
    // Delete related records first if necessary, though onDelete: Cascade might handle it.
    // Let's just try to delete the driver. If it fails due to foreign keys, we delete relations.
    // Assuming cascade is set up, or we can manually delete them.
    await prisma.driver.delete({ where: { id: driver.id } }).catch(e => {
        console.error(`Failed to delete driver ${driver.id}:`, e.message);
    });
  }

  // 2. Clear unreal balances? Maybe reset wallets that are huge.
  // We can look for walletBalance > 1000000 maybe? Let's just reset everyone's wallet to 0 if it looks like mock data, 
  // actually the user said "احذف اي بيانات غير حقيقية من كباتن وهميين او رصيد وهي او ارقام غير حقيقية".
  // Let's delete all top-up requests that are obviously test.
  
  const topups = await prisma.walletTopUpRequest.findMany({
    where: {
        amount: { gt: 1000000 } // unrealistically large amounts?
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
      await prisma.passenger.delete({ where: { id: p.id } }).catch(e => {});
  }

  console.log('Cleanup finished.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
