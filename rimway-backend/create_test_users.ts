import { PrismaClient, UserRole, DriverStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create or Update Captain
  const captainPhone = '+22233333333';
  let captain = await prisma.user.findUnique({ where: { phone: captainPhone } });
  
  if (!captain) {
    captain = await prisma.user.create({
      data: {
        phone: captainPhone,
        role: UserRole.DRIVER,
        name: 'Test Captain',
      }
    });
    console.log(`Created Captain User: ${captainPhone}`);
  } else {
    captain = await prisma.user.update({
      where: { phone: captainPhone },
      data: { role: UserRole.DRIVER }
    });
    console.log(`Updated existing user to Captain: ${captainPhone}`);
  }

  // Ensure Driver record exists
  const driverRecord = await prisma.driver.findUnique({ where: { userId: captain.id } });
  if (!driverRecord) {
    await prisma.driver.create({
      data: {
        userId: captain.id,
        status: DriverStatus.APPROVED,
        rating: 5.0,
      }
    });
    console.log(`Created Driver Profile for Captain`);
  }

  // Create or Update Admin
  const adminPhone = '+22244444444';
  let admin = await prisma.user.findUnique({ where: { phone: adminPhone } });
  
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        phone: adminPhone,
        role: UserRole.ADMIN,
        name: 'Test Admin',
      }
    });
    console.log(`Created Admin User: ${adminPhone}`);
  } else {
    admin = await prisma.user.update({
      where: { phone: adminPhone },
      data: { role: UserRole.ADMIN }
    });
    console.log(`Updated existing user to Admin: ${adminPhone}`);
  }

}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
