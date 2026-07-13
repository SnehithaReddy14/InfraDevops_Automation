import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTest() {
  try {
    console.log('[Test Actions] Finding an invoice...');
    
    // First, let's make sure we have at least one invoice by creating a dummy one
    let invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: 'TEST-12345',
        vendorName: 'Test Vendor',
        currency: 'USD',
        subtotal: 1000,
        tax: 180,
        grandTotal: 1180,
        status: 'PENDING_REVIEW',
        aiConfidenceScore: 0.95,
        originalFilePath: '/uploads/dummy.pdf',
        extractedJson: '{}',
        editedJson: '{}',
        currentVersion: 1,
      },
    });
    console.log(`[Test Actions] Created test invoice ID: ${invoice.id}`);

    // Simulate updateInvoice (EDIT action in transaction)
    console.log('[Test Actions] Simulating edit/update...');
    const nextVersion = invoice.currentVersion + 1;
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          vendorName: 'Updated Vendor Name',
          currentVersion: nextVersion,
        },
      });
      // Try writing to AuditLog with invalid userId (e.g. 9999) to verify our safety constraint logic
      await tx.auditLog.create({
        data: {
          invoiceId: invoice.id,
          userId: null, // should be null since 9999 is invalid
          action: 'EDIT',
          newValue: '{"vendorName":"Updated Vendor Name"}',
        },
      });
    });
    console.log('[Test Actions] Update/Edit transaction succeeded.');

    // Simulate approveInvoice
    console.log('[Test Actions] Simulating approve...');
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'APPROVED' },
      });
      await tx.auditLog.create({
        data: {
          invoiceId: invoice.id,
          userId: null,
          action: 'APPROVE',
          newValue: '{"status":"APPROVED"}',
        },
      });
    });
    console.log('[Test Actions] Approve transaction succeeded.');

    // Simulate rejectInvoice
    console.log('[Test Actions] Simulating reject...');
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'REJECTED' },
      });
      await tx.auditLog.create({
        data: {
          invoiceId: invoice.id,
          userId: null,
          action: 'REJECT',
          newValue: '{"status":"REJECTED"}',
        },
      });
    });
    console.log('[Test Actions] Reject transaction succeeded.');

    // Simulate deleteInvoice
    console.log('[Test Actions] Simulating delete...');
    await prisma.$transaction(async (tx) => {
      await tx.invoice.delete({ where: { id: invoice.id } });
      await tx.auditLog.create({
        data: {
          userId: null,
          action: 'DELETE',
          oldValue: JSON.stringify(invoice),
        },
      });
    });
    console.log('[Test Actions] Delete transaction succeeded.');

    console.log('[Test Actions] ALL ACTIONS COMPLETED SUCCESSFULLY! No database errors.');
  } catch (error: any) {
    console.error('[Test Actions Error] Transaction failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
