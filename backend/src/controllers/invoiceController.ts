import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';
import { prisma } from '../utils/db';
import { extractInvoiceData } from '../services/ocrService';
import { askAssistant } from '../services/assistantService';

// Setup file storage paths
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 1. Upload Invoice and Run AI OCR
export const uploadInvoice = async (req: any, res: Response): Promise<any> => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { filename, path: filePath, mimetype, size } = req.file;
  const userId = req.user?.id || 1; // Default to admin user (id: 1) if not provided

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const relativePath = `/uploads/${filename}`;

    // Extract invoice data via real AI OCR
    let extractedData;
    try {
      extractedData = await extractInvoiceData(fileBuffer, mimetype, filename);
    } catch (ocrError: any) {
      console.error('[OCR Error]', ocrError.message);
      // Clean up the uploaded file if OCR fails
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(422).json({
        error: 'AI Extraction failed',
        details: ocrError.message,
      });
    }

    // Save in Database using Prisma
    const invoiceData: any = {
      invoiceNumber: extractedData.invoiceNumber,
      invoiceDate: extractedData.invoiceDate,
      dueDate: extractedData.dueDate,
      vendorName: extractedData.vendorName,
      vendorAddress: extractedData.vendorAddress,
      vendorEmail: extractedData.vendorEmail,
      vendorPhone: extractedData.vendorPhone,
      customerName: extractedData.customerName,
      customerAddress: extractedData.customerAddress,
      customerEmail: extractedData.customerEmail,
      customerPhone: extractedData.customerPhone,
      gstNumber: extractedData.gstNumber,
      vatNumber: extractedData.vatNumber,
      purchaseOrder: extractedData.purchaseOrder,
      currency: extractedData.currency,
      subtotal: extractedData.subtotal,
      discount: extractedData.discount,
      tax: extractedData.tax,
      shipping: extractedData.shipping,
      grandTotal: extractedData.grandTotal,
      billingPeriod: extractedData.billingPeriod,
      paymentTerms: extractedData.paymentTerms,
      status: 'PENDING_REVIEW',
      aiConfidenceScore: extractedData.confidenceScore,
      originalFilePath: relativePath,
      extractedJson: JSON.stringify(extractedData),
      editedJson: JSON.stringify(extractedData),
      currentVersion: 1,
      // Skip creatorId for now - test without it
    };
    
    const invoice = await (async () => {
      const inv = await prisma.invoice.create({ data: invoiceData });

      // Save Line Items
      if (extractedData.lineItems && extractedData.lineItems.length > 0) {
        await prisma.invoiceItem.createMany({
          data: extractedData.lineItems.map((item) => ({
            invoiceId: inv.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          })),
        });
      }

      // Save Attachment
      await prisma.attachment.create({
        data: {
          invoiceId: inv.id,
          filePath: relativePath,
          fileType: mimetype,
          fileSize: size,
        },
      });

      // Create Audit Logs (non-critical, may fail if user doesn't exist)
      try {
        if (userId) {
          await prisma.auditLog.create({
            data: {
              invoiceId: inv.id,
              userId,
              action: 'UPLOAD',
              ipAddress: req.ip || req.socket.remoteAddress,
              newValue: JSON.stringify({ filename, size, mimetype }),
            },
          });

          await prisma.auditLog.create({
            data: {
              invoiceId: inv.id,
              userId,
              action: 'EXTRACT',
              ipAddress: req.ip || req.socket.remoteAddress,
              newValue: JSON.stringify(extractedData),
            },
          });

          // Create general timeline activity log
          await prisma.activityLog.create({
            data: {
              userId,
              description: `Uploaded and extracted invoice ${extractedData.invoiceNumber} from ${extractedData.vendorName}`,
            },
          });
        }
      } catch (logError) {
        // Silently continue - audit logs are non-critical
      }

      return inv;
    })();

    const fullInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true, attachments: true },
    });

    return res.status(201).json({
      message: 'Invoice processed successfully',
      invoice: fullInvoice,
    });
  } catch (error: any) {
    console.error('Invoice processing error:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(500).json({ error: 'Internal server error processing invoice' });
  }
};

// 2. Fetch Invoices with Advanced Filters & Sorting
export const getInvoices = async (req: Request, res: Response): Promise<any> => {
  const {
    page = '1',
    limit = '10',
    search = '',
    status,
    vendor,
    currency,
    minAmount,
    maxAmount,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const p = parseInt(page as string);
  const l = parseInt(limit as string);
  const skip = (p - 1) * l;

  const where: any = {};

  // Global search (invoice number, vendor, customer)
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search as string, mode: 'insensitive' } },
      { vendorName: { contains: search as string, mode: 'insensitive' } },
      { customerName: { contains: search as string, mode: 'insensitive' } },
      { vendorEmail: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  // Exact filters
  if (status) {
    where.status = status;
  }
  if (vendor) {
    where.vendorName = { contains: vendor as string, mode: 'insensitive' };
  }
  if (currency) {
    where.currency = currency;
  }

  // Range filters
  if (minAmount || maxAmount) {
    where.grandTotal = {};
    if (minAmount) where.grandTotal.gte = parseFloat(minAmount as string);
    if (maxAmount) where.grandTotal.lte = parseFloat(maxAmount as string);
  }

  if (startDate || endDate) {
    where.invoiceDate = {};
    if (startDate) where.invoiceDate.gte = new Date(startDate as string);
    if (endDate) where.invoiceDate.lte = new Date(endDate as string);
  }

  try {
    const totalCount = await prisma.invoice.count({ where });
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { [sortBy as string]: sortOrder },
      skip,
      take: l,
      include: { items: true },
    });

    return res.status(200).json({
      invoices,
      pagination: {
        page: p,
        limit: l,
        totalCount,
        totalPages: Math.ceil(totalCount / l),
      },
    });
  } catch (error) {
    console.error('Fetch invoices error:', error);
    return res.status(500).json({ error: 'Internal server error fetching invoices' });
  }
};

// 3. Fetch Single Invoice Detail
export const getInvoiceById = async (req: Request, res: Response): Promise<any> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid invoice ID' });

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        attachments: true,
        auditLogs: {
          include: { user: { select: { name: true, email: true, role: true } } },
          orderBy: { timestamp: 'desc' },
        },
        creator: { select: { name: true, email: true, role: true } },
      },
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    return res.status(200).json({ invoice });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 4. Update Invoice & Save Diffs/Version History
export const updateInvoice = async (req: any, res: Response): Promise<any> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid invoice ID' });

  const userId = req.user?.id;
  const { items, ...invoiceData } = req.body;

  try {
    // Validate userId exists in database to prevent FK constraint crashes (defensive coding)
    let validUserId: number | null = null;
    if (userId) {
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (userExists) validUserId = userId;
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Prepare update parameters (recalculate totals if items were updated)
    let subtotal = invoiceData.subtotal !== undefined ? parseFloat(invoiceData.subtotal) : existingInvoice.subtotal;
    let discount = invoiceData.discount !== undefined ? parseFloat(invoiceData.discount) : existingInvoice.discount;
    let tax = invoiceData.tax !== undefined ? parseFloat(invoiceData.tax) : existingInvoice.tax;
    let shipping = invoiceData.shipping !== undefined ? parseFloat(invoiceData.shipping) : existingInvoice.shipping;
    let grandTotal = invoiceData.grandTotal !== undefined ? parseFloat(invoiceData.grandTotal) : existingInvoice.grandTotal;

    if (items && Array.isArray(items)) {
      // Calculate subtotal from items
      subtotal = items.reduce((acc: number, curr: any) => acc + (parseFloat(curr.quantity) * parseFloat(curr.unitPrice)), 0);
      grandTotal = subtotal - discount + tax + shipping;
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // Create version increment
      const nextVersion = existingInvoice.currentVersion + 1;

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: invoiceData.invoiceNumber,
          invoiceDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : null,
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
          vendorName: invoiceData.vendorName,
          vendorAddress: invoiceData.vendorAddress,
          vendorEmail: invoiceData.vendorEmail,
          vendorPhone: invoiceData.vendorPhone,
          customerName: invoiceData.customerName,
          customerAddress: invoiceData.customerAddress,
          customerEmail: invoiceData.customerEmail,
          customerPhone: invoiceData.customerPhone,
          gstNumber: invoiceData.gstNumber,
          vatNumber: invoiceData.vatNumber,
          purchaseOrder: invoiceData.purchaseOrder,
          currency: invoiceData.currency,
          subtotal,
          discount,
          tax,
          shipping,
          grandTotal,
          billingPeriod: invoiceData.billingPeriod,
          paymentTerms: invoiceData.paymentTerms,
          status: invoiceData.status || existingInvoice.status,
          currentVersion: nextVersion,
          editedJson: JSON.stringify({ ...invoiceData, lineItems: items }),
        },
      });

      // Update line items if provided
      if (items && Array.isArray(items)) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({
          data: items.map((item: any) => ({
            invoiceId: id,
            description: item.description,
            quantity: parseFloat(item.quantity) || 1,
            unitPrice: parseFloat(item.unitPrice) || 0,
            amount: parseFloat(item.quantity) * parseFloat(item.unitPrice) || 0,
          })),
        });
      }

      // Compile differences for AuditLog
      const diff: any = {};
      const fields = [
        'invoiceNumber', 'invoiceDate', 'dueDate', 'vendorName', 'vendorAddress',
        'customerName', 'subtotal', 'discount', 'tax', 'grandTotal', 'status'
      ];

      for (const field of fields) {
        const oldVal = (existingInvoice as any)[field];
        const newVal = (updated as any)[field];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          diff[field] = { old: oldVal, new: newVal };
        }
      }

      // Add audit log entry
      await tx.auditLog.create({
        data: {
          invoiceId: id,
          userId: validUserId,
          action: 'EDIT',
          ipAddress: req.ip || req.socket.remoteAddress,
          oldValue: JSON.stringify(existingInvoice),
          newValue: JSON.stringify(updated),
        },
      });

      await tx.activityLog.create({
        data: {
          userId: validUserId,
          description: `Updated details for invoice ${updated.invoiceNumber}`,
        },
      });

      return updated;
    });

    const fullUpdated = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, attachments: true },
    });

    return res.status(200).json({
      message: 'Invoice updated successfully',
      invoice: fullUpdated,
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    return res.status(500).json({ error: 'Internal server error updating invoice' });
  }
};

// 5. Approve Invoice
export const approveInvoice = async (req: any, res: Response): Promise<any> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid invoice ID' });

  const userId = req.user?.id;

  try {
    // Validate userId exists in database to prevent FK constraint crashes (defensive coding)
    let validUserId: number | null = null;
    if (userId) {
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (userExists) validUserId = userId;
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      await tx.auditLog.create({
        data: {
          invoiceId: id,
          userId: validUserId,
          action: 'APPROVE',
          ipAddress: req.ip || req.socket.remoteAddress,
          oldValue: JSON.stringify({ status: invoice.status }),
          newValue: JSON.stringify({ status: 'APPROVED' }),
        },
      });

      await tx.activityLog.create({
        data: {
          userId: validUserId,
          description: `Approved invoice ${invoice.invoiceNumber}`,
        },
      });

      return inv;
    });

    return res.status(200).json({ message: 'Invoice approved successfully', invoice: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error approving invoice' });
  }
};

// 6. Reject Invoice
export const rejectInvoice = async (req: any, res: Response): Promise<any> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid invoice ID' });

  const userId = req.user?.id;

  try {
    // Validate userId exists in database to prevent FK constraint crashes (defensive coding)
    let validUserId: number | null = null;
    if (userId) {
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (userExists) validUserId = userId;
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id },
        data: { status: 'REJECTED' },
      });

      await tx.auditLog.create({
        data: {
          invoiceId: id,
          userId: validUserId,
          action: 'REJECT',
          ipAddress: req.ip || req.socket.remoteAddress,
          oldValue: JSON.stringify({ status: invoice.status }),
          newValue: JSON.stringify({ status: 'REJECTED' }),
        },
      });

      await tx.activityLog.create({
        data: {
          userId: validUserId,
          description: `Rejected invoice ${invoice.invoiceNumber}`,
        },
      });

      return inv;
    });

    return res.status(200).json({ message: 'Invoice rejected successfully', invoice: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error rejecting invoice' });
  }
};

// 7. Delete Invoice
export const deleteInvoice = async (req: any, res: Response): Promise<any> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid invoice ID' });

  const userId = req.user?.id;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Validate userId exists in database to prevent FK constraint crashes (defensive coding)
    let validUserId: number | null = null;
    if (userId) {
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (userExists) validUserId = userId;
    }

    await prisma.$transaction(async (tx) => {
      // Delete invoice (Cascade will delete items and attachments)
      await tx.invoice.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: validUserId,
          action: 'DELETE',
          ipAddress: req.ip || req.socket.remoteAddress,
          oldValue: JSON.stringify(invoice),
        },
      });

      await tx.activityLog.create({
        data: {
          userId: validUserId,
          description: `Deleted invoice ${invoice.invoiceNumber}`,
        },
      });
    });

    // Remove physical files associated
    for (const attachment of invoice.attachments) {
      const localFilePath = path.join(__dirname, '..', '..', attachment.filePath);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    }

    return res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return res.status(500).json({ error: 'Internal server error deleting invoice' });
  }
};

// 8. Bulk Operations (Approve, Reject, Delete)
export const handleBulkAction = async (req: any, res: Response): Promise<any> => {
  const { ids, action } = req.body;
  const userId = req.user?.id;

  if (!ids || !Array.isArray(ids) || ids.length === 0 || !action) {
    return res.status(400).json({ error: 'Invoice IDs and action are required' });
  }

  const numericIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));

  try {
    // Validate userId exists in database to prevent FK constraint crashes (defensive coding)
    let validUserId: number | null = null;
    if (userId) {
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (userExists) validUserId = userId;
    }

    if (action === 'DELETE') {
      const attachments = await prisma.attachment.findMany({
        where: { invoiceId: { in: numericIds } },
      });

      await prisma.$transaction(async (tx) => {
        await tx.invoice.deleteMany({
          where: { id: { in: numericIds } },
        });

        for (const id of numericIds) {
          await tx.auditLog.create({
            data: {
              userId: validUserId,
              action: 'DELETE_BULK',
              ipAddress: req.ip || req.socket.remoteAddress,
              oldValue: JSON.stringify({ id }),
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: validUserId,
            description: `Bulk deleted ${numericIds.length} invoices`,
          },
        });
      });

      // Clear files
      for (const attachment of attachments) {
        const localFilePath = path.join(__dirname, '..', '..', attachment.filePath);
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
      }

      return res.status(200).json({ message: `Bulk deleted ${numericIds.length} invoices successfully` });
    } else if (action === 'APPROVE' || action === 'REJECT') {
      const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

      await prisma.$transaction(async (tx) => {
        await tx.invoice.updateMany({
          where: { id: { in: numericIds } },
          data: { status: newStatus },
        });

        for (const id of numericIds) {
          await tx.auditLog.create({
            data: {
              invoiceId: id,
              userId: validUserId,
              action: action,
              ipAddress: req.ip || req.socket.remoteAddress,
              newValue: JSON.stringify({ status: newStatus }),
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: validUserId,
            description: `Bulk status updated ${numericIds.length} invoices to ${newStatus}`,
          },
        });
      });

      return res.status(200).json({ message: `Bulk updated ${numericIds.length} invoices successfully` });
    } else {
      return res.status(400).json({ error: 'Unsupported bulk action' });
    }
  } catch (error) {
    console.error('Bulk action error:', error);
    return res.status(500).json({ error: 'Internal server error performing bulk action' });
  }
};

// 9. Dashboard Statistics Aggregator
export const getDashboardStats = async (req: Request, res: Response): Promise<any> => {
  try {
    const invoiceCount = await prisma.invoice.count();
    
    // Sums and counts by status
    const statusCounts = await prisma.invoice.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { grandTotal: true },
    });

    const totalRevenueSum = await prisma.invoice.aggregate({
      where: { status: { in: ['APPROVED', 'PAID'] } },
      _sum: { grandTotal: true },
    });

    const pendingReviewCount = await prisma.invoice.count({ where: { status: 'PENDING_REVIEW' } });
    const approvedCount = await prisma.invoice.count({ where: { status: 'APPROVED' } });
    const rejectedCount = await prisma.invoice.count({ where: { status: 'REJECTED' } });
    const paidCount = await prisma.invoice.count({ where: { status: 'PAID' } });
    const unpaidCount = await prisma.invoice.count({ where: { status: 'UNPAID' } });

    // Vendors count
    const uniqueVendors = await prisma.invoice.groupBy({
      by: ['vendorName'],
    });

    // Monthly spend / revenue trend
    const allInvoices = await prisma.invoice.findMany({
      where: { status: { in: ['APPROVED', 'PAID'] } },
      select: { grandTotal: true, invoiceDate: true },
    });

    const monthlyTrends: Record<string, number> = {};
    for (const inv of allInvoices) {
      if (inv.invoiceDate) {
        const monthYear = inv.invoiceDate.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthlyTrends[monthYear] = (monthlyTrends[monthYear] || 0) + inv.grandTotal;
      }
    }

    const trendArray = Object.entries(monthlyTrends).map(([name, value]) => ({
      name,
      value,
    })).reverse().slice(-12); // Last 12 months

    // Vendor spending breakdown
    const vendorSums = await prisma.invoice.groupBy({
      by: ['vendorName'],
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: 5,
    });

    const vendorSpendData = vendorSums.map((v) => ({
      name: v.vendorName || 'Unknown',
      value: v._sum.grandTotal || 0,
    }));

    // Status breakdown for Pie Chart
    const statusData = statusCounts.map(s => ({
      name: s.status,
      value: s._sum.grandTotal || 0,
      count: s._count.id,
    }));

    // Recent activities (timeline)
    const recentActivity = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: { user: { select: { name: true, role: true } } },
    });

    return res.status(200).json({
      metrics: {
        totalInvoices: invoiceCount,
        totalRevenue: totalRevenueSum._sum.grandTotal || 0,
        pendingReview: pendingReviewCount,
        approved: approvedCount,
        rejected: rejectedCount,
        paid: paidCount,
        unpaid: unpaidCount,
        uniqueVendors: uniqueVendors.length,
      },
      charts: {
        monthlyRevenue: trendArray,
        vendorSpending: vendorSpendData,
        statusBreakdown: statusData,
      },
      recentActivity: recentActivity.map(act => ({
        id: act.id,
        user: act.user?.name || 'System',
        role: act.user?.role || '',
        description: act.description,
        timestamp: act.timestamp,
      })),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ error: 'Internal server error compiling dashboard stats' });
  }
};

// 10. AI Finance Assistant Query
export const queryAssistant = async (req: Request, res: Response): Promise<any> => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query string is required' });
  }

  try {
    const result = await askAssistant(query);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Assistant error:', error);
    return res.status(500).json({ error: 'Assistant failed to process query', details: error.message });
  }
};

// 11. Export Invoices (Excel, CSV, JSON, PDF)
export const exportInvoices = async (req: any, res: Response): Promise<any> => {
  const { ids, format = 'csv' } = req.query;
  const userId = req.user?.id;

  let where: any = {};
  if (ids) {
    const numericIds = (ids as string).split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    where.id = { in: numericIds };
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where,
      include: { items: true },
    });

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'No invoices found to export' });
    }

    // Write audit log entry
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'EXPORT',
        ipAddress: req.ip || req.socket.remoteAddress,
        newValue: JSON.stringify({ count: invoices.length, format }),
      },
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=invoices-export-${Date.now()}.json`);
      return res.status(200).send(JSON.stringify(invoices, null, 2));
    }

    // Flattens invoices for tabular formats
    const rows = invoices.map(inv => ({
      'Invoice Number': inv.invoiceNumber,
      'Invoice Date': inv.invoiceDate ? inv.invoiceDate.toISOString().split('T')[0] : '',
      'Due Date': inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : '',
      'Vendor Name': inv.vendorName || '',
      'Customer Name': inv.customerName || '',
      'Currency': inv.currency,
      'Subtotal': inv.subtotal,
      'Tax': inv.tax,
      'Discount': inv.discount,
      'Shipping': inv.shipping,
      'Grand Total': inv.grandTotal,
      'Status': inv.status,
      'AI Confidence': inv.aiConfidenceScore.toFixed(2),
    }));

    if (format === 'csv') {
      const headers = Object.keys(rows[0]).join(',');
      const body = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const csvContent = `${headers}\n${body}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=invoices-export-${Date.now()}.csv`);
      return res.status(200).send(csvContent);
    }

    if (format === 'excel' || format === 'xlsx') {
      const worksheet = xlsx.utils.json_to_sheet(rows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Invoices');
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=invoices-export-${Date.now()}.xlsx`);
      return res.status(200).send(buffer);
    }

    if (format === 'pdf') {
      // Generate a basic HTML representation that will render beautifully
      let html = `
        <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { color: #2563EB; border-bottom: 2px solid #2563EB; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #F3F4F6; }
            .total { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Invoice Export Summary</h1>
          <p>Export Date: ${new Date().toLocaleDateString()}</p>
          <p>Total Records: ${invoices.length}</p>
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Vendor</th>
                <th>Date</th>
                <th>Status</th>
                <th>Grand Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map(i => `
                <tr>
                  <td>${i.invoiceNumber}</td>
                  <td>${i.vendorName || 'N/A'}</td>
                  <td>${i.invoiceDate ? i.invoiceDate.toLocaleDateString() : 'N/A'}</td>
                  <td>${i.status}</td>
                  <td class="total">${i.currency} ${i.grandTotal.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename=invoices-export-${Date.now()}.html`);
      return res.status(200).send(html);
    }

    return res.status(400).json({ error: 'Unsupported export format' });
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Internal server error exporting invoices' });
  }
};

// 12. Fetch All Audit Logs
export const getAuditLogs = async (req: Request, res: Response): Promise<any> => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { name: true, email: true, role: true } },
        invoice: { select: { invoiceNumber: true, vendorName: true } }
      },
      take: 100, // Safe limit
    });
    return res.status(200).json({ logs });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    return res.status(500).json({ error: 'Internal server error fetching audit logs' });
  }
};
