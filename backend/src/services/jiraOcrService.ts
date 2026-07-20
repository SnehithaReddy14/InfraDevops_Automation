import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';
import {
  JiraSubscriptionLine,
  parseSeatFromText,
} from '../utils/saasUtils';

export interface ExtractedJiraInvoiceData {
  invoiceNumber: string;
  invoiceDate: Date | null;
  billingPeriod: string | null;
  billingMonth: string | null;
  vendorName: string;
  currency: string;
  totalCost: number;
  /** @deprecated derived from subscriptionLines — kept for legacy API consumers */
  itsmUsersCost: number;
  developersCost: number;
  tempoCost: number;
  subscriptionLines: JiraSubscriptionLine[];
}

function finalizeJiraResult(result: Partial<ExtractedJiraInvoiceData>): ExtractedJiraInvoiceData {
  const subscriptionLines = result.subscriptionLines ?? [];
  const totalFromLines = subscriptionLines.reduce((s, l) => s + l.amount, 0);

  return {
    vendorName: result.vendorName || 'Unknown vendor',
    invoiceNumber: result.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
    invoiceDate: result.invoiceDate ?? null,
    billingPeriod: result.billingPeriod ?? null,
    billingMonth: result.billingMonth ?? null,
    currency: result.currency || 'USD',
    totalCost: result.totalCost && result.totalCost > 0 ? result.totalCost : totalFromLines,
    itsmUsersCost: 0,
    developersCost: 0,
    tempoCost: 0,
    subscriptionLines,
  };
}

function normalizeSubscriptionLines(raw: unknown): JiraSubscriptionLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const product = String(row.product || row.description || '').trim();
      const amount = Number(row.amount ?? row.total ?? 0);
      const seatInfo = parseSeatFromText(String(row.seatCount ?? '')) || parseSeatFromText(product);
      const seatCount = seatInfo?.seatCount ?? (Number(row.seatCount) || 0);
      const billingUnit =
        seatInfo?.billingUnit ||
        (String(row.billingUnit || 'seats').toLowerCase() as JiraSubscriptionLine['billingUnit']);

      if (!product || amount <= 0) return null;
      const line: JiraSubscriptionLine = {
        product,
        seatCount,
        billingUnit,
        amount,
      };
      const listPrice = Number(row.listPrice);
      if (listPrice > 0) line.listPrice = listPrice;
      return line;
    })
    .filter((line): line is JiraSubscriptionLine => line !== null);
}

export async function extractJiraInvoiceData(
  fileBuffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ExtractedJiraInvoiceData> {
  let result: Partial<ExtractedJiraInvoiceData> | null = null;

  if (process.env.GEMINI_API_KEY) {
    try {
      result = await processJiraGeminiMultimodalOCR(fileBuffer, mimeType, filename);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Jira OCR] Gemini failed:', message);
    }
  }

  if (!result && mimeType.toLowerCase() === 'application/pdf') {
    try {
      result = await processJiraLocalPDFFallback(fileBuffer, filename);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Jira OCR] PDF parse failed:', message);
    }
  }

  if (!result || !(result.subscriptionLines?.length || result.totalCost)) {
    throw new Error(
      'Could not extract line items from this invoice. Use a readable PDF and ensure GEMINI_API_KEY is set for best results.'
    );
  }

  if (!result.billingMonth) {
    if (result.billingPeriod) {
      const startPart = result.billingPeriod.split('-')[0].trim();
      const d = new Date(startPart);
      if (!isNaN(d.getTime())) {
        const mShort = d.toLocaleString('en-US', { month: 'short' });
        const yShort = d.getFullYear().toString().slice(-2);
        result.billingMonth = `${mShort}-${yShort}`;
      }
    }
    if (!result.billingMonth && result.invoiceDate) {
      const d = new Date(result.invoiceDate);
      if (!isNaN(d.getTime())) {
        const mShort = d.toLocaleString('en-US', { month: 'short' });
        const yShort = d.getFullYear().toString().slice(-2);
        result.billingMonth = `${mShort}-${yShort}`;
      }
    }
  }

  return finalizeJiraResult(result);
}

async function processJiraGeminiMultimodalOCR(
  fileBuffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ExtractedJiraInvoiceData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key is not configured');

  console.log(`[Jira OCR] Running Gemini on ${filename}...`);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `Analyze this subscription/SaaS invoice PDF. Extract every billed product line exactly as shown.
Return JSON:
{
  "vendorName": "string",
  "invoiceNumber": "string",
  "invoiceDate": "YYYY-MM-DD or null",
  "billingPeriod": "string or null",
  "currency": "3-letter code",
  "totalCost": number,
  "subscriptionLines": [
    {
      "product": "exact product name from invoice",
      "seatCount": number,
      "billingUnit": "users" | "agents" | "seats",
      "listPrice": number,
      "amount": number
    }
  ]
}
Rules:
- One object per invoice line item (do not merge products).
- seatCount and billingUnit come from the invoice text (e.g. "46 users", "7 agents").
- amount is the final billed amount for that line after discounts.
- totalCost matches the invoice total. Do not invent products or seat counts.`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: fileBuffer.toString('base64'), mimeType } },
  ]);
  const parsed = JSON.parse(result.response.text());

  return finalizeJiraResult({
    vendorName: parsed.vendorName,
    invoiceNumber: parsed.invoiceNumber,
    invoiceDate: parsed.invoiceDate ? new Date(parsed.invoiceDate) : null,
    billingPeriod: parsed.billingPeriod || null,
    billingMonth: null,
    currency: parsed.currency || 'USD',
    totalCost: Number(parsed.totalCost) || 0,
    subscriptionLines: normalizeSubscriptionLines(parsed.subscriptionLines),
  });
}

function extractProductName(section: string): string {
  const lines = section
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines[0] || '';
  return first.replace(/^\d+\.?\s*/, '').trim() || 'Subscription line';
}

function extractSectionAmount(section: string): number {
  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lineMatches = line.match(/[0-9,]+\.[0-9]{2}/g);
    if (lineMatches?.length) {
      return parseFloat(lineMatches[lineMatches.length - 1].replace(/,/g, '')) || 0;
    }
  }
  const anyFloats = section.match(/[0-9,]+\.[0-9]{2}/g);
  if (anyFloats?.length) {
    return parseFloat(anyFloats[anyFloats.length - 1].replace(/,/g, '')) || 0;
  }
  return 0;
}

async function processJiraLocalPDFFallback(
  fileBuffer: Buffer,
  filename: string
): Promise<ExtractedJiraInvoiceData> {
  console.log(`[Jira OCR] Local PDF parse on ${filename}...`);

  const parser = new PDFParse({ data: fileBuffer });
  const textResult = await parser.getText();
  const text = textResult.text || '';
  await parser.destroy();

  let invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const invMatch = text.match(/(?:invoice\s*number|invoice\s*#)\s*[:#-]?\s*([a-zA-Z0-9-]+)/i);
  if (invMatch) invoiceNumber = invMatch[1].trim();

  let invoiceDate: Date | null = null;
  const dateMatch = text.match(/(?:invoice\s*date)\s*[:#-]?\s*([a-zA-Z0-9\s,/-]+)/i);
  if (dateMatch) {
    const parsedDate = Date.parse(dateMatch[1].trim());
    if (!isNaN(parsedDate)) invoiceDate = new Date(parsedDate);
  }

  let billingPeriod: string | null = null;
  const periodMatch = text.match(/(?:billing\s*period)\s*[:#-]?\s*([a-zA-Z0-9\s,/-]+)/i);
  if (periodMatch) billingPeriod = periodMatch[1].trim();

  let currency = 'USD';
  if (/₹|inr/i.test(text)) currency = 'INR';
  else if (/€|eur/i.test(text)) currency = 'EUR';

  let totalCost = 0;
  const totalMatch = text.match(
    /(?:total\s+billed\s+amount|invoice\s+total|amount\s+paid)\s*[:$]?\s*(?:USD|usd)?\s*([0-9,.]+)/i
  );
  if (totalMatch) totalCost = parseFloat(totalMatch[1].replace(/,/g, '')) || 0;

  const subscriptionLines: JiraSubscriptionLine[] = [];
  const sections = text.split(/\n\s*(?=\b\d+\.?\s+[A-Za-z])/);

  for (const section of sections) {
    const amount = extractSectionAmount(section);
    if (amount <= 0) continue;

    const product = extractProductName(section);
    if (/total|subtotal|tax|discount|payment due/i.test(product)) continue;

    const seatInfo = parseSeatFromText(section);
    subscriptionLines.push({
      product,
      seatCount: seatInfo?.seatCount ?? 0,
      billingUnit: seatInfo?.billingUnit ?? 'seats',
      amount,
    });
  }

  if (subscriptionLines.length === 0) {
    throw new Error('No product line items found in PDF text.');
  }

  return finalizeJiraResult({
    vendorName: text.match(/Atlassian| Pty Ltd/i) ? 'Atlassian' : undefined,
    invoiceNumber,
    invoiceDate,
    billingPeriod,
    billingMonth: null,
    currency,
    totalCost,
    subscriptionLines,
  });
}
