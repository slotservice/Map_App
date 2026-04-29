/**
 * Dev seed: minimum data to log in and click around.
 * Re-runnable; uses upsert.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@fullcirclefm.local' },
    update: {},
    create: {
      email: 'admin@fullcirclefm.local',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    },
  });

  await prisma.user.upsert({
    where: { email: 'worker@fullcirclefm.local' },
    update: {},
    create: {
      email: 'worker@fullcirclefm.local',
      passwordHash,
      firstName: 'Worker',
      lastName: 'User',
      role: 'worker',
    },
  });

  await prisma.user.upsert({
    where: { email: 'vendor@fullcirclefm.local' },
    update: {},
    create: {
      email: 'vendor@fullcirclefm.local',
      passwordHash,
      firstName: 'Vendor',
      lastName: 'User',
      role: 'vendor',
    },
  });

  // eslint-disable-next-line no-console
  console.log('✔ Seeded 3 users (password: password123)');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
