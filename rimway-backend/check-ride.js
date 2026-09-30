const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const ride = await prisma.ride.findUnique({
    where: { id: '4de9f3c7-591d-44ea-b590-5f25e5e5b9b5' },
    include: {
      walletTransactions: true,
    },
  });

  console.log(JSON.stringify(ride, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
