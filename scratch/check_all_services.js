const { PrismaClient } = require('../rimway-backend/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://rimway:rimway_pass@localhost:5432/rimway_db?schema=public"
    }
  }
});

async function main() {
  const all = await prisma.serviceType.findMany();
  console.log(JSON.stringify(all, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
