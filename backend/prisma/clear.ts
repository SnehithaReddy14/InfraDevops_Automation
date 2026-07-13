import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Clear] Removing all invoice and transaction history...');
  
  // Clear transaction tables
  await prisma.activityLog.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.attachment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  
  console.log('[Clear] Database successfully cleared to fresh state. User login accounts preserved.');
}

main()
  .catch((e) => {
    console.error('[Clear Error] Failed to clear database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
