const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rides = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Ride"`);
  const wtx = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "WalletTransaction"`);
  console.log("AFTER_RIDE_COUNT:", rides[0].count.toString());
  console.log("AFTER_WTX_COUNT:", wtx[0].count.toString());

  const statuses = await prisma.$queryRawUnsafe(`
    SELECT enumlabel 
    FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RideStatus')
  `);
  console.log("RideStatus Enums:", statuses.map(s => s.enumlabel));

  const cols = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_name IN ('Ride', 'WalletTransaction', 'ServiceType', 'AuditLog') 
    AND column_name IN ('customerName', 'customerPhone', 'source', 'payloadHash', 'rideId', 'version', 'reason')
  `);
  console.log("New Columns:", JSON.stringify(cols, null, 2));

  const constraints = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'WalletTransaction' AND indexdef LIKE '%rideId%type%'
  `);
  console.log("Constraints:", JSON.stringify(constraints, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
