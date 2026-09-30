const { PrismaClient } = require('../rimway-backend/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://rimway:rimway_pass@localhost:5432/rimway_db?schema=public"
    }
  }
});

async function main() {
  // Deactivate test service types
  await prisma.serviceType.updateMany({
    where: {
      name: { contains: 'Test' }
    },
    data: {
      isActive: false
    }
  });

  // Ensure Standard service type is properly set
  const standard = await prisma.serviceType.upsert({
    where: { id: '8858557b-6eaf-46a9-bce8-0f2cb6d7288e' },
    update: {
      name: 'Standard',
      baseFare: 0,
      perKm: 25,
      minFare: 50,
      perMinute: 0,
      serviceFee: 10,
      isActive: true,
      version: 1
    },
    create: {
      id: '8858557b-6eaf-46a9-bce8-0f2cb6d7288e',
      name: 'Standard',
      baseFare: 0,
      perKm: 25,
      minFare: 50,
      perMinute: 0,
      serviceFee: 10,
      isActive: true,
      version: 1
    }
  });

  console.log('Cleaned up service types. Current Standard service:');
  console.log({
    id: standard.id,
    name: standard.name,
    baseFare: Number(standard.baseFare),
    perKm: Number(standard.perKm),
    minFare: Number(standard.minFare),
    serviceFee: Number(standard.serviceFee),
    isActive: standard.isActive,
    version: standard.version
  });

  await prisma.$disconnect();
}

main().catch(console.error);
