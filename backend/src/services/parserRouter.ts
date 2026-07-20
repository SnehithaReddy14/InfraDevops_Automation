import { extractInvoiceData as genericParser } from './ocrService';
import { extractE2EInvoiceData as e2eParser } from './e2eOcrService';
import { extractJiraInvoiceData as jiraParser } from './jiraOcrService';
import { subscriptionLinesToInvoiceItems } from '../utils/saasUtils';

export interface ParseResult {
  invoiceNumber: string;
  invoiceDate: Date | null;
  dueDate: Date | null;
  vendorName: string;
  vendorAddress: string | null;
  vendorEmail: string | null;
  vendorPhone: string | null;
  customerName: string | null;
  customerAddress: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  gstNumber: string | null;
  vatNumber: string | null;
  purchaseOrder: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grandTotal: number;
  billingPeriod: string | null;
  billingMonth?: string | null;
  awsAccount?: string | null;
  paymentTerms: string | null;
  confidenceScore: number;
  metadata?: string | null;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    gstRate?: number;
    taxAmount?: number;
  }>;
}

export async function parseInvoiceByProvider(
  fileBuffer: Buffer,
  mimeType: string,
  filename: string,
  provider: string
): Promise<ParseResult> {
  const providerLower = provider.toLowerCase();

  // Route to E2E parser
  if (providerLower === 'e2e' || providerLower === 'e2e cloud') {
    try {
      const data = await e2eParser(fileBuffer, mimeType, filename);
      return {
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        dueDate: null,
        vendorName: data.vendorName || 'E2E Networks',
        vendorAddress: null,
        vendorEmail: null,
        vendorPhone: null,
        customerName: null,
        customerAddress: null,
        customerEmail: null,
        customerPhone: null,
        gstNumber: null,
        vatNumber: null,
        purchaseOrder: null,
        currency: data.currency || 'INR',
        subtotal: data.currency === 'USD' ? data.totalCostUsd : data.totalCostInr,
        discount: 0,
        tax: 0,
        shipping: 0,
        grandTotal: data.currency === 'USD' ? data.totalCostUsd : data.totalCostInr,
        billingPeriod: data.billingPeriod,
        billingMonth: data.billingMonth,
        awsAccount: null,
        paymentTerms: null,
        confidenceScore: 0.95,
        metadata: JSON.stringify(data),
        lineItems: []
      };
    } catch (err) {
      console.error('[ParserRouter] E2E Parser failed, running AI Fallback...', err);
    }
  }

  // Route to Jira parser
  if (providerLower === 'jira') {
    try {
      const data = await jiraParser(fileBuffer, mimeType, filename);
      const lineItems = subscriptionLinesToInvoiceItems(data.subscriptionLines);
      const metadata = {
        ...data,
        invoiceDate: data.invoiceDate?.toISOString?.() ?? data.invoiceDate,
        subscriptionLines: data.subscriptionLines,
      };
      return {
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        dueDate: null,
        vendorName: data.vendorName || 'Atlassian Jira',
        vendorAddress: null,
        vendorEmail: null,
        vendorPhone: null,
        customerName: null,
        customerAddress: null,
        customerEmail: null,
        customerPhone: null,
        gstNumber: null,
        vatNumber: null,
        purchaseOrder: null,
        currency: data.currency || 'USD',
        subtotal: data.totalCost,
        discount: 0,
        tax: 0,
        shipping: 0,
        grandTotal: data.totalCost,
        billingPeriod: data.billingPeriod,
        billingMonth: data.billingMonth,
        awsAccount: null,
        paymentTerms: null,
        confidenceScore: 0.95,
        metadata: JSON.stringify(metadata),
        lineItems,
      };
    } catch (err) {
      console.error('[ParserRouter] Jira Parser failed, running AI Fallback...', err);
    }
  }

  // Fallback / General routing (AWS, GCP, Azure, Oracle, DigitalOcean, Custom, etc.)
  try {
    const data = await genericParser(fileBuffer, mimeType, filename);
    return data as ParseResult;
  } catch (err) {
    console.error('[ParserRouter] Generic AI parser failed, throwing...', err);
    throw err;
  }
}
