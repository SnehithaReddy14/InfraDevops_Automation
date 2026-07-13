import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Clearing existing records...');
  await prisma.activityLog.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.attachment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.setting.deleteMany({});

  console.log('[Seed] Generating bcrypt password hashes...');
  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('[Seed] Seeding users...');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@company.com',
      passwordHash,
      name: 'Sarah Connor',
      role: 'ADMIN',
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@company.com',
      passwordHash,
      name: 'John Doe',
      role: 'FINANCE_MANAGER',
    },
  });

  const employee = await prisma.user.create({
    data: {
      email: 'employee@company.com',
      passwordHash,
      name: 'David Lightman',
      role: 'EMPLOYEE',
    },
  });

  const auditor = await prisma.user.create({
    data: {
      email: 'auditor@company.com',
      passwordHash,
      name: 'Marcus Wright',
      role: 'AUDITOR',
    },
  });

  console.log('[Seed] Seeding system settings...');
  await prisma.setting.createMany({
    data: [
      { key: 'company_name', value: 'Antigravity Technologies Pvt Ltd', description: 'Primary company identity' },
      { key: 'base_currency', value: 'INR', description: 'Base reporting currency' },
      { key: 'ocr_service', value: 'Google Cloud Document AI', description: 'Active OCR processor' },
    ],
  });

  console.log('[Seed] Seeding invoices & items...');
  
  // Invoice 1: AWS (Paid in June)
  const awsDate = new Date(2026, 5, 12); // June 12, 2026
  const awsInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: 'AWS-2026-7890',
      invoiceDate: awsDate,
      dueDate: new Date(2026, 5, 27),
      vendorName: 'Amazon Web Services Inc.',
      vendorAddress: '410 Terry Ave N, Seattle, WA 98109, USA',
      vendorEmail: 'billing@aws.amazon.com',
      vendorPhone: '+1-206-266-1000',
      customerName: 'Antigravity Technologies',
      customerAddress: 'C-Block, Connaught Place, New Delhi, 110001, India',
      customerEmail: 'finance@antigravity.com',
      customerPhone: '+91-11-4567-8901',
      gstNumber: '07AAAAC1234A1Z0',
      vatNumber: null,
      purchaseOrder: 'PO-2026-0045',
      currency: 'INR',
      subtotal: 130000.0,
      discount: 0.0,
      tax: 24000.0,
      shipping: 0.0,
      grandTotal: 154000.0,
      billingPeriod: 'June 2026',
      paymentTerms: 'NET 15',
      status: 'PAID',
      aiConfidenceScore: 0.94,
      originalFilePath: '/uploads/invoice-aws-sample.pdf',
      currentVersion: 1,
      creatorId: employee.id,
      extractedJson: '{}',
      editedJson: '{}',
    },
  });

  await prisma.invoiceItem.createMany({
    data: [
      {
        invoiceId: awsInvoice.id,
        description: 'Amazon Elastic Compute Cloud (EC2) Instance Hours',
        quantity: 2.0,
        unitPrice: 45000.0,
        amount: 90000.0,
      },
      {
        invoiceId: awsInvoice.id,
        description: 'Amazon Simple Storage Service (S3) usage',
        quantity: 1.0,
        unitPrice: 40000.0,
        amount: 40000.0,
      },
    ],
  });

  // Invoice 2: Vercel (Approved in July)
  const vercelDate = new Date(2026, 6, 2); // July 2, 2026
  const vercelInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: 'VERC-99081',
      invoiceDate: vercelDate,
      dueDate: new Date(2026, 6, 17),
      vendorName: 'Vercel Inc.',
      vendorAddress: '340 S Lemon Ave, Walnut, CA 91789, USA',
      vendorEmail: 'billing@vercel.com',
      vendorPhone: null,
      customerName: 'Antigravity Technologies',
      customerAddress: 'C-Block, Connaught Place, New Delhi, 110001, India',
      customerEmail: 'engineering@antigravity.com',
      customerPhone: '+91-11-4567-8901',
      gstNumber: null,
      vatNumber: null,
      purchaseOrder: 'PO-2026-0046',
      currency: 'INR',
      subtotal: 70000.0,
      discount: 0.0,
      tax: 12000.0,
      shipping: 0.0,
      grandTotal: 82000.0,
      billingPeriod: 'July 2026',
      paymentTerms: 'NET 15',
      status: 'APPROVED',
      aiConfidenceScore: 0.98,
      originalFilePath: '/uploads/invoice-vercel-sample.pdf',
      currentVersion: 1,
      creatorId: employee.id,
      extractedJson: '{}',
      editedJson: '{}',
    },
  });

  await prisma.invoiceItem.createMany({
    data: [
      {
        invoiceId: vercelInvoice.id,
        description: 'Vercel Pro Team Plan Subscription (July)',
        quantity: 1.0,
        unitPrice: 30000.0,
        amount: 30000.0,
      },
      {
        invoiceId: vercelInvoice.id,
        description: 'Serverless Edge Functions (additional compute seconds)',
        quantity: 4.0,
        unitPrice: 10000.0,
        amount: 40000.0,
      },
    ],
  });

  // Invoice 3: Google (Pending Review in July)
  const gcpDate = new Date(2026, 6, 11); // July 11, 2026
  const gcpInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: 'GCP-778619',
      invoiceDate: gcpDate,
      dueDate: new Date(2026, 6, 26),
      vendorName: 'Google Cloud EMEA Ltd',
      vendorAddress: 'Gordon House, Barrow St, Dublin 4, Ireland',
      vendorEmail: 'gcp-billing-support@google.com',
      vendorPhone: '+353-1-436-1000',
      customerName: 'Antigravity Technologies',
      customerAddress: 'C-Block, Connaught Place, New Delhi, 110001, India',
      customerEmail: 'finance@antigravity.com',
      customerPhone: '+91-11-4567-8901',
      gstNumber: '07AAACG1890B1D4',
      vatNumber: 'IE6388655V',
      purchaseOrder: null,
      currency: 'INR',
      subtotal: 38000.0,
      discount: 0.0,
      tax: 7000.0,
      shipping: 0.0,
      grandTotal: 45000.0,
      billingPeriod: 'July 1 to July 10',
      paymentTerms: 'NET 15',
      status: 'PENDING_REVIEW',
      aiConfidenceScore: 0.88,
      originalFilePath: '/uploads/invoice-gcp-sample.pdf',
      currentVersion: 1,
      creatorId: employee.id,
      extractedJson: '{}',
      editedJson: '{}',
    },
  });

  await prisma.invoiceItem.createMany({
    data: [
      {
        invoiceId: gcpInvoice.id,
        description: 'Compute Engine virtual machine resource instances',
        quantity: 1.0,
        unitPrice: 20000.0,
        amount: 20000.0,
      },
      {
        invoiceId: gcpInvoice.id,
        description: 'BigQuery Data Warehouse storage and query analytics',
        quantity: 1.0,
        unitPrice: 18000.0,
        amount: 18000.0,
      },
    ],
  });

  // Attachments
  await prisma.attachment.createMany({
    data: [
      { invoiceId: awsInvoice.id, filePath: '/uploads/invoice-aws-sample.pdf', fileType: 'application/pdf', fileSize: 450000 },
      { invoiceId: vercelInvoice.id, filePath: '/uploads/invoice-vercel-sample.pdf', fileType: 'application/pdf', fileSize: 180000 },
      { invoiceId: gcpInvoice.id, filePath: '/uploads/invoice-gcp-sample.pdf', fileType: 'application/pdf', fileSize: 320000 },
    ],
  });

  console.log('[Seed] Seeding audit logs...');
  // Seed Audit Logs for AWS
  await prisma.auditLog.create({
    data: {
      invoiceId: awsInvoice.id,
      userId: employee.id,
      action: 'UPLOAD',
      ipAddress: '192.168.1.15',
      newValue: JSON.stringify({ filename: 'aws-invoice-june.pdf', size: 450000 }),
    },
  });
  await prisma.auditLog.create({
    data: {
      invoiceId: awsInvoice.id,
      userId: employee.id,
      action: 'EXTRACT',
      ipAddress: '192.168.1.15',
      newValue: JSON.stringify(awsInvoice),
    },
  });
  await prisma.auditLog.create({
    data: {
      invoiceId: awsInvoice.id,
      userId: manager.id,
      action: 'APPROVE',
      ipAddress: '192.168.1.20',
      oldValue: JSON.stringify({ status: 'PENDING_REVIEW' }),
      newValue: JSON.stringify({ status: 'APPROVED' }),
    },
  });

  // Seed Audit Logs for Vercel
  await prisma.auditLog.create({
    data: {
      invoiceId: vercelInvoice.id,
      userId: employee.id,
      action: 'UPLOAD',
      ipAddress: '192.168.1.15',
      newValue: JSON.stringify({ filename: 'vercel-sub.pdf', size: 180000 }),
    },
  });
  await prisma.auditLog.create({
    data: {
      invoiceId: vercelInvoice.id,
      userId: employee.id,
      action: 'EXTRACT',
      ipAddress: '192.168.1.15',
      newValue: JSON.stringify(vercelInvoice),
    },
  });

  // Seed general activity timeline logs
  await prisma.activityLog.createMany({
    data: [
      { userId: employee.id, description: `Uploaded invoice ${awsInvoice.invoiceNumber} for Amazon Web Services` },
      { userId: manager.id, description: `Approved invoice ${awsInvoice.invoiceNumber} for payment` },
      { userId: employee.id, description: `Uploaded invoice ${vercelInvoice.invoiceNumber} for Vercel Inc.` },
      { userId: employee.id, description: `Uploaded invoice ${gcpInvoice.invoiceNumber} for Google Cloud` },
    ],
  });

  console.log('[Seed] Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Seed Error] Seeding process failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
