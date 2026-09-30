const { PrismaClient } = require('../rimway-backend/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://rimway:rimway_pass@localhost:5432/rimway_db?schema=public"
    }
  }
});

async function run() {
  console.log('--- Testing Pricing Precision & Synchronization ---');
  
  // 1. Check ServiceType
  const st = await prisma.serviceType.findFirst({
    where: { isActive: true }
  });
  console.log('ServiceType active:', {
    name: st.name,
    baseFare: Number(st.baseFare),
    perKm: Number(st.perKm),
    minFare: Number(st.minFare),
    perMinute: Number(st.perMinute),
    version: st.version
  });

  // 2. Test 2 km calculation:
  // formula: Math.max(minFare, baseFare + (distanceKm * perKm))
  const distanceKm = 2.0;
  const rawFare = Number(st.baseFare) + (distanceKm * Number(st.perKm));
  const expectedFare = Math.max(Number(st.minFare), Math.round(rawFare));
  
  console.log(`Calculation for ${distanceKm} km at ${Number(st.perKm)} MRU/km:`);
  console.log(`Base Fare: ${Number(st.baseFare)} MRU`);
  console.log(`Distance Fare: ${distanceKm} * ${Number(st.perKm)} = ${distanceKm * Number(st.perKm)} MRU`);
  console.log(`Total Fare: ${expectedFare} MRU`);
  
  if (expectedFare !== 50) {
    console.error(`ERROR: Expected 50 MRU for 2km, but got ${expectedFare} MRU!`);
    process.exit(1);
  } else {
    console.log('SUCCESS: 2 km correctly equals 50 MRU (NOT 140 MRU)!');
  }

  // 3. Test 1 km calculation:
  const dist1Km = 1.0;
  const raw1 = Number(st.baseFare) + (dist1Km * Number(st.perKm));
  const fare1 = Math.max(Number(st.minFare), Math.round(raw1));
  console.log(`Calculation for 1 km: raw = ${raw1} MRU -> with minFare (${Number(st.minFare)}) = ${fare1} MRU`);

  // 4. Test 4 km calculation:
  const dist4Km = 4.0;
  const raw4 = Number(st.baseFare) + (dist4Km * Number(st.perKm));
  const fare4 = Math.max(Number(st.minFare), Math.round(raw4));
  console.log(`Calculation for 4 km: ${fare4} MRU`);

  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
