const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const rides = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Ride"`);
    const wtx = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "WalletTransaction"`);
    console.log("BEFORE_RIDE_COUNT:", rides[0].count.toString());
    console.log("BEFORE_WTX_COUNT:", wtx[0].count.toString());
  } catch(e) { console.log(e); }
}
main().catch(console.error).finally(() => prisma.$disconnect());
