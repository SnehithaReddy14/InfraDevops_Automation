import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Clearing existing records...');
  await prisma.attachment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('[Seed] Generating bcrypt password hashes...');
  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('[Seed] Seeding users...');
  await prisma.user.create({
    data: {
      email: 'admin@company.com',
      passwordHash,
      name: 'Demo Admin',
      role: 'ADMIN',
    },
  });

  console.log('[Seed] Database seeding completed successfully (fresh config without dummy invoices).');
}

main()
  .catch((e) => {
    console.error('[Seed Error] Seeding process failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
