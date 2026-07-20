import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';
import { prisma } from '../utils/db';
import { parseInvoiceByProvider } from '../services/parserRouter';
import { askAssistant } from '../services/assistantService';
import { enrichMetadataWithTotals, normalizeCurrency } from '../utils/currencyUtils';
import { invoiceIdsForEnvironment, persistInvoiceEnvironment, distinctInvoiceEnvironments } from '../utils/invoiceEnvironment';
import { ensureFreshExchangeRate, getInrPerUsd } from '../services/exchangeRateService';
import { enrichInvoice, enrichInvoices, extractInvoiceDetails, splitInvoicePayload } from '../utils/invoiceDetails';

// Setup file storage paths
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 1. Upload Invoice and Run AI OCR
export const uploadInvoice = async (req: any, res: Response): Promise<any> => {
  const userId = req.user?.id || 1; // Default to admin user (id: 1) if not provided

  let filename = '';
  let filePath = '';
  let mimetype = 'application/pdf';
  let size = 0;
  let relativePath = '';

  try {
    let extractedData: any;

    if (req.file) {
      filename = req.file.filename;
      filePath = req.file.path;
      mimetype = req.file.mimetype;
      size = req.file.size;
      const fileBuffer = fs.readFileSync(filePath);
      relativePath = `/uploads/${filename}`;

      let projectId = req.body.projectId || req.query.projectId;
      let billingProvider = 'Custom';
      let parsedProjectId: number | null = null;

      if (projectId) {
        parsedProjectId = parseInt(projectId);
        if (!isNaN(parsedProjectId)) {
          const project = await prisma.project.findUnique({
            where: { id: parsedProjectId }
          });
          if (project) {
            billingProvider = project.billingProvider;
          }
        }
      }

      // Extract invoice data via routed parsers
      try {
        extractedData = await parseInvoiceByProvider(fileBuffer, mimetype, filename, billingProvider);
      } catch (ocrError: any) {
        console.error('[OCR Error]', ocrError.message);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(422).json({
          error: 'AI Extraction failed',
          details: ocrError.message,
        });
      }
    } else if (req.body.tempFilePath) {
      relativePath = req.body.tempFilePath;
      filename = path.basename(relativePath);
      filePath = path.join(__dirname, '..', '..', relativePath);
      extractedData = {
        invoiceNumber: req.body.invoiceNumber,
        invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : null,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        vendorName: req.body.vendorName,
        vendorAddress: req.body.vendorAddress,
        vendorEmail: req.body.vendorEmail,
        vendorPhone: req.body.vendorPhone,
        customerName: req.body.customerName,
        customerAddress: req.body.customerAddress,
        customerEmail: req.body.customerEmail,
        customerPhone: req.body.customerPhone,
        gstNumber: req.body.gstNumber,
        vatNumber: req.body.vatNumber,
        purchaseOrder: req.body.purchaseOrder,
        currency: req.body.currency || 'USD',
        subtotal: parseFloat(req.body.subtotal) || 0,
        discount: parseFloat(req.body.discount) || 0,
        tax: parseFloat(req.body.tax) || 0,
        shipping: parseFloat(req.body.shipping) || 0,
        grandTotal: parseFloat(req.body.grandTotal) || 0,
        billingPeriod: req.body.billingPeriod,
        billingMonth: req.body.billingMonth,
        awsAccount: req.body.awsAccount,
        paymentTerms: req.body.paymentTerms,
        confidenceScore: parseFloat(req.body.confidenceScore) || 0.95,
        lineItems: req.body.lineItems || []
      };
    } else {
      return res.status(400).json({ error: 'No file uploaded and no pre-extracted details provided' });
    }

    // Check if duplicate invoice exists by invoice number
    const duplicateInvoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: extractedData.invoiceNumber },
      include: { attachments: true }
    });

    if (duplicateInvoice) {
      // Auto-overwrite the existing duplicate invoice statement
      for (const attachment of duplicateInvoice.attachments) {
        const localFilePath = path.join(__dirname, '..', '..', attachment.filePath);
        if (fs.existsSync(localFilePath)) {
          try {
            fs.unlinkSync(localFilePath);
          } catch (err) {}
        }
      }
      await prisma.invoice.delete({
        where: { id: duplicateInvoice.id }
      });
    }

    // Save in Database using Prisma
    await ensureFreshExchangeRate();
    const resolvedCurrency = normalizeCurrency(
      extractedData.currency || req.body.defaultCurrency || 'USD'
    );
    let metadataObj: Record<string, unknown> = {};
    try {
      if (extractedData.metadata) {
        metadataObj =
          typeof extractedData.metadata === 'string'
            ? JSON.parse(extractedData.metadata)
            : extractedData.metadata;
      } else {
        metadataObj = { ...extractedData };
      }
    } catch {
      metadataObj = { ...extractedData };
    }
    metadataObj = enrichMetadataWithTotals(
      metadataObj,
      resolvedCurrency,
      Number(extractedData.grandTotal) || 0
    );

    const detailFields = extractInvoiceDetails({
      ...extractedData,
      dueDate:
        extractedData.dueDate instanceof Date
          ? extractedData.dueDate.toISOString()
          : extractedData.dueDate,
    });
    if (Object.keys(detailFields).length > 0) {
      metadataObj.details = {
        ...((metadataObj.details as Record<string, unknown>) || {}),
        ...detailFields,
      };
    }

    const envValue =
      (typeof req.body.environment === 'string' && req.body.environment.trim()) ||
      (typeof extractedData.environment === 'string' && extractedData.environment.trim()) ||
      null;
    if (envValue) {
      metadataObj.environment = envValue;
    }

    const invoiceData: any = {
      invoiceNumber: extractedData.invoiceNumber,
      invoiceDate: extractedData.invoiceDate,
      vendorName: extractedData.vendorName,
      currency: resolvedCurrency,
      subtotal: extractedData.subtotal,
      discount: extractedData.discount,
      tax: extractedData.tax,
      shipping: extractedData.shipping,
      grandTotal: extractedData.grandTotal,
      billingPeriod: extractedData.billingPeriod,
      billingMonth: extractedData.billingMonth || req.body.billingMonth || null,
      awsAccount: extractedData.awsAccount || req.body.awsAccount || null,
      status: 'SAVED',
      aiConfidenceScore: extractedData.confidenceScore || 0.95,
      originalFilePath: relativePath,
      extractedJson: JSON.stringify({ ...extractedData, currency: resolvedCurrency }),
      editedJson: JSON.stringify({ ...extractedData, currency: resolvedCurrency }),
      metadata: JSON.stringify(metadataObj),
      currentVersion: 1,
      projectId: req.body.projectId ? parseInt(req.body.projectId) : (req.query.projectId ? parseInt(req.query.projectId as string) : null),
    };
    
    const invoice = await (async () => {
      const inv = await prisma.invoice.create({ data: invoiceData });
      await persistInvoiceEnvironment(inv.id, envValue);

      // Save Line Items
      if (extractedData.lineItems && extractedData.lineItems.length > 0) {
        await prisma.invoiceItem.createMany({
          data: extractedData.lineItems.map((item: any) => ({
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
    projectId,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const p = parseInt(page as string);
  const l = parseInt(limit as string);
  const skip = (p - 1) * l;

  const where: any = {};

  if (projectId) {
    const parsedPid = parseInt(projectId as string);
    if (!isNaN(parsedPid)) {
      where.projectId = parsedPid;
    }
  }

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
      invoices: enrichInvoices(invoices),
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
        creator: { select: { name: true, email: true, role: true } },
        project: { select: { id: true, name: true, code: true } },
      },
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    return res.status(200).json({ invoice: enrichInvoice(invoice) });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 4. Update Invoice & Save Diffs/Version History
export const updateInvoice = async (req: any, res: Response): Promise<any> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid invoice ID' });

  const { items, ...rawInvoiceData } = req.body;

  try {
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const { core: invoiceData, metadataJson } = splitInvoicePayload({
      ...rawInvoiceData,
      metadata: rawInvoiceData.metadata ?? existingInvoice.metadata,
    });

    // Prepare update parameters (recalculate totals if items were updated)
    let subtotal = invoiceData.subtotal !== undefined ? parseFloat(String(invoiceData.subtotal)) : existingInvoice.subtotal;
    let discount = invoiceData.discount !== undefined ? parseFloat(String(invoiceData.discount)) : existingInvoice.discount;
    let tax = invoiceData.tax !== undefined ? parseFloat(String(invoiceData.tax)) : existingInvoice.tax;
    let shipping = invoiceData.shipping !== undefined ? parseFloat(String(invoiceData.shipping)) : existingInvoice.shipping;
    let grandTotal = invoiceData.grandTotal !== undefined ? parseFloat(String(invoiceData.grandTotal)) : existingInvoice.grandTotal;

    if (items && Array.isArray(items)) {
      subtotal = items.reduce((acc: number, curr: any) => acc + (parseFloat(curr.quantity) * parseFloat(curr.unitPrice)), 0);
      grandTotal = subtotal - discount + tax + shipping;
    }

    await prisma.$transaction(async (tx) => {
      const nextVersion = existingInvoice.currentVersion + 1;

      await tx.invoice.update({
        where: { id },
        data: {
          ...(invoiceData.invoiceNumber !== undefined && { invoiceNumber: String(invoiceData.invoiceNumber) }),
          ...(invoiceData.invoiceDate !== undefined && {
            invoiceDate: invoiceData.invoiceDate ? new Date(String(invoiceData.invoiceDate)) : null,
          }),
          ...(invoiceData.vendorName !== undefined && { vendorName: String(invoiceData.vendorName) }),
          ...(invoiceData.currency !== undefined && { currency: String(invoiceData.currency) }),
          subtotal,
          discount,
          tax,
          shipping,
          grandTotal,
          ...(invoiceData.billingPeriod !== undefined && { billingPeriod: String(invoiceData.billingPeriod) }),
          ...(invoiceData.billingMonth !== undefined && { billingMonth: String(invoiceData.billingMonth) }),
          ...(invoiceData.awsAccount !== undefined && { awsAccount: String(invoiceData.awsAccount) }),
          status: (invoiceData.status as string) || existingInvoice.status,
          metadata: metadataJson ?? existingInvoice.metadata,
          currentVersion: nextVersion,
          editedJson: JSON.stringify({ ...rawInvoiceData, lineItems: items }),
        },
      });

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
    });

    const fullUpdated = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, attachments: true },
    });

    return res.status(200).json({
      message: 'Invoice updated successfully',
      invoice: fullUpdated ? enrichInvoice(fullUpdated) : null,
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

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id },
        data: { status: 'APPROVED' },
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

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id },
        data: { status: 'REJECTED' },
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

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    await prisma.$transaction(async (tx) => {
      await tx.invoice.delete({ where: { id } });
    });

    // Remove physical files associated
    if (invoice.originalFilePath) {
      const mainPath = path.join(__dirname, '..', '..', invoice.originalFilePath);
      if (fs.existsSync(mainPath)) {
        try { fs.unlinkSync(mainPath); } catch { /* ignore file cleanup errors */ }
      }
    }
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

  if (!ids || !Array.isArray(ids) || ids.length === 0 || !action) {
    return res.status(400).json({ error: 'Invoice IDs and action are required' });
  }

  const numericIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));

  try {
    if (action === 'DELETE') {
      const attachments = await prisma.attachment.findMany({
        where: { invoiceId: { in: numericIds } },
      });

      await prisma.$transaction(async (tx) => {
        await tx.invoice.deleteMany({
          where: { id: { in: numericIds } },
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
    } else if (action === 'APPROVE' || action === 'REJECT' || action === 'PAID' || action === 'UNPAID') {
      const newStatus = action === 'APPROVE' 
        ? 'APPROVED' 
        : action === 'REJECT' 
          ? 'REJECTED' 
          : action === 'PAID' 
            ? 'PAID' 
            : 'UNPAID';

      await prisma.$transaction(async (tx) => {
        await tx.invoice.updateMany({
          where: { id: { in: numericIds } },
          data: { status: newStatus },
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
    const targetCurrency = String(req.query.defaultCurrency || 'USD').toUpperCase();

    await ensureFreshExchangeRate();
    const inrPerUsd = getInrPerUsd();

    // Exchange rates with USD base (INR rate is live)
    const EXCHANGE_RATES: Record<string, number> = {
      USD: 1.0,
      INR: inrPerUsd,
      EUR: 0.92,
      GBP: 0.78,
    };

    const convertCurrency = (amount: number, from: string | null | undefined, to: string): number => {
      const fromUpper = (from || 'USD').toUpperCase();
      const toUpper = (to || 'USD').toUpperCase();
      if (fromUpper === toUpper) return amount;
      const rateFrom = EXCHANGE_RATES[fromUpper] || 1.0;
      const rateTo = EXCHANGE_RATES[toUpper] || 1.0;
      return (amount / rateFrom) * rateTo;
    };

    // Load all invoices to do correct currency conversion in-memory
    const envFilter = typeof req.query.environment === 'string' ? req.query.environment.trim() : '';
    const distinctEnvs = await distinctInvoiceEnvironments();
    const envIds = await invoiceIdsForEnvironment(envFilter || undefined);

    const invoices = await prisma.invoice.findMany({
      where: envIds ? { id: { in: envIds.length ? envIds : [-1] } } : undefined,
      select: {
        id: true,
        grandTotal: true,
        currency: true,
        status: true,
        vendorName: true,
        invoiceDate: true,
        billingPeriod: true,
        billingMonth: true,
        projectId: true,
        project: { select: { id: true, name: true } },
      }
    });

    const invoiceCount = invoices.length;

    const billableStatuses = ['SAVED', 'SCANNED', 'PENDING_REVIEW', 'APPROVED', 'PAID', 'UNPAID'];

    // Total revenue — all saved/uploaded invoices except rejected/draft
    let totalRevenue = 0;
    invoices.forEach(inv => {
      if (billableStatuses.includes(inv.status)) {
        totalRevenue += convertCurrency(inv.grandTotal, inv.currency, targetCurrency);
      }
    });

    // Unique Vendors count
    const uniqueVendors = Array.from(new Set(invoices.map(i => i.vendorName).filter(Boolean)));

    const getMonthFromBillingPeriod = (billingPeriod: string | null | undefined, fallbackDate: Date | null): string => {
      if (billingPeriod) {
        const trimmed = billingPeriod.trim();
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December',
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        
        for (const name of monthNames) {
          const regex = new RegExp(`\\b${name}\\b`, 'i');
          if (regex.test(trimmed)) {
            const shortName = name.slice(0, 3);
            const capitalized = shortName.charAt(0).toUpperCase() + shortName.slice(1).toLowerCase();
            const yearMatch = trimmed.match(/\b(20\d{2})\b/);
            if (yearMatch) {
              return `${capitalized} ${yearMatch[1]}`;
            }
            if (fallbackDate) {
              return `${capitalized} ${fallbackDate.getFullYear()}`;
            }
            return `${capitalized} ${new Date().getFullYear()}`;
          }
        }
        
        const ymMatch1 = trimmed.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])\b/);
        if (ymMatch1) {
          const year = ymMatch1[1];
          const monthIdx = parseInt(ymMatch1[2]) - 1;
          const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${monthNamesShort[monthIdx]} ${year}`;
        }

        const ymMatch2 = trimmed.match(/\b(0[1-9]|1[0-2])[-/](20\d{2})\b/);
        if (ymMatch2) {
          const year = ymMatch2[2];
          const monthIdx = parseInt(ymMatch2[1]) - 1;
          const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${monthNamesShort[monthIdx]} ${year}`;
        }
      }
      
      if (fallbackDate) {
        return fallbackDate.toLocaleString('default', { month: 'short', year: 'numeric' });
      }
      return new Date().toLocaleString('default', { month: 'short', year: 'numeric' });
    };

    // Monthly trends in target currency
    const monthlyTrends: Record<string, number> = {};
    invoices.forEach(inv => {
      if (billableStatuses.includes(inv.status)) {
        const monthYear = inv.billingMonth?.trim() || getMonthFromBillingPeriod(inv.billingPeriod, inv.invoiceDate);
        const convertedVal = convertCurrency(inv.grandTotal, inv.currency, targetCurrency);
        monthlyTrends[monthYear] = (monthlyTrends[monthYear] || 0) + convertedVal;
      }
    });

    const trendArray = Object.entries(monthlyTrends).map(([name, value]) => ({
      name,
      value,
    }));

    trendArray.sort((a, b) => {
      const parseDate = (str: string) => {
        const parts = str.split(' ');
        if (parts.length === 2) {
          const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(parts[0].toLowerCase());
          const year = parseInt(parts[1]);
          if (monthIndex !== -1 && !isNaN(year)) {
            return new Date(year, monthIndex, 1).getTime();
          }
        }
        return 0;
      };
      return parseDate(a.name) - parseDate(b.name);
    });

    const finalTrendArray = trendArray.slice(-12);

    // Vendor spending breakdown in target currency
    const vendorSpendingMap: Record<string, number> = {};
    invoices.forEach(inv => {
      if (billableStatuses.includes(inv.status)) {
        const vendor = inv.vendorName || 'Unknown Vendor';
        const convertedVal = convertCurrency(inv.grandTotal, inv.currency, targetCurrency);
        vendorSpendingMap[vendor] = (vendorSpendingMap[vendor] || 0) + convertedVal;
      }
    });

    const vendorSpendData = Object.entries(vendorSpendingMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const parseMonthSortKey = (str: string): number => {
      const parts = str.split(/[\s-]+/).filter(Boolean);
      if (parts.length >= 2) {
        const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(
          parts[0].slice(0, 3).toLowerCase()
        );
        const yearRaw = parts[parts.length - 1];
        const year = yearRaw.length === 2 ? parseInt(`20${yearRaw}`) : parseInt(yearRaw);
        if (monthIndex !== -1 && !isNaN(year)) {
          return new Date(year, monthIndex, 1).getTime();
        }
      }
      return 0;
    };

    const projectCount = await prisma.project.count();

    // All projects as columns (includes newly created projects with no invoices yet)
    const allProjects = await prisma.project.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    const matrix: Record<string, Record<number, number>> = {};

    invoices.forEach((inv) => {
      if (!billableStatuses.includes(inv.status)) return;
      const monthKey = inv.billingMonth?.trim() || getMonthFromBillingPeriod(inv.billingPeriod, inv.invoiceDate);
      const converted = convertCurrency(inv.grandTotal, inv.currency, targetCurrency);

      if (!matrix[monthKey]) matrix[monthKey] = {};
      if (inv.projectId) {
        matrix[monthKey][inv.projectId] = (matrix[monthKey][inv.projectId] || 0) + converted;
      }
    });

    const months = Object.keys(matrix).sort((a, b) => parseMonthSortKey(a) - parseMonthSortKey(b));

    const billingMatrix = {
      projects: allProjects.map((p) => ({ id: p.id, name: p.name, code: p.code })),
      months: months.map((month) => {
        const cells = allProjects.map((p) => ({
          projectId: p.id,
          amount: matrix[month][p.id] ?? 0,
        }));
        return {
          month,
          cells,
          rowTotal: cells.reduce((sum, c) => sum + c.amount, 0),
        };
      }),
      columnTotals: allProjects.map((p) => ({
        projectId: p.id,
        amount: months.reduce((sum, m) => sum + (matrix[m][p.id] ?? 0), 0),
      })),
      grandTotal: months.reduce(
        (sum, m) => sum + allProjects.reduce((s, p) => s + (matrix[m][p.id] ?? 0), 0),
        0
      ),
    };

    return res.status(200).json({
      metrics: {
        totalInvoices: invoiceCount,
        totalRevenue,
        projectCount,
        uniqueVendors: uniqueVendors.length,
      },
      charts: {
        monthlyRevenue: finalTrendArray,
        vendorSpending: vendorSpendData,
      },
      billingMatrix,
      distinctInvoiceEnvironments: distinctEnvs,
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

// Extract Invoice OCR data (without saving to database)
export const extractInvoiceOnly = async (req: any, res: Response): Promise<any> => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { filename, path: filePath, mimetype } = req.file;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const relativePath = `/uploads/${filename}`;

    const extractedData = await parseInvoiceByProvider(fileBuffer, mimetype, filename, 'Custom');

    return res.status(200).json({
      ...extractedData,
      tempFilePath: relativePath
    });
  } catch (error: any) {
    console.error('[OCR Extract Error]', error.message);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(422).json({
      error: 'AI Extraction failed',
      details: error.message,
    });
  }
};
