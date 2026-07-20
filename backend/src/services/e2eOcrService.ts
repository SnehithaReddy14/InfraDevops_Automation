import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';

import {
  detectCurrencyFromText,
  normalizeCurrency,
  toInr,
  toUsd,
  type NormalizedCurrency,
} from '../utils/currencyUtils';

const NODE_FIELD_RE = /^node(\d+)(Charges|Cdp)$/i;
const BACKUP_AGENT_IP = '216.48.184.189';

const KNOWN_NODE_IPS: Record<string, number> = {
  '164.52.204.208': 1,
  '91.203.134.219': 2,
  '216.48.180.14': 3,
  '216.48.190.255': 4,
  '164.52.215.3': 5,
  '151.185.41.128': 6,
  '151.185.42.78': 7,
  '164.52.213.163': 8,
};

type NodeTotals = Map<number, { charges: number; cdp: number }>;

export interface ExtractedE2EInvoiceData {
  invoiceNumber: string;
  invoiceDate: Date | null;
  billingPeriod: string | null;
  billingMonth: string | null;
  vendorName: string;
  currency: string;
  backupAgentCharges: number;
  storageBackups: number;
  savedImages: number;
  snapshots: number;
  totalCostInr: number;
  totalCostUsd: number;
  /** Dynamic per-node fields, e.g. node1Charges, node9Cdp */
  [key: string]: string | number | Date | null;
}

function createNodeTotals(): NodeTotals {
  return new Map();
}

function addNodeAmount(totals: NodeTotals, nodeNum: number, amount: number, isCdp: boolean): void {
  if (!totals.has(nodeNum)) totals.set(nodeNum, { charges: 0, cdp: 0 });
  const entry = totals.get(nodeNum)!;
  if (isCdp) entry.cdp += amount;
  else entry.charges += amount;
}

function nodeTotalsToFields(totals: NodeTotals): Record<string, number> {
  const fields: Record<string, number> = {};
  [...totals.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([n, v]) => {
      fields[`node${n}Charges`] = v.charges;
      fields[`node${n}Cdp`] = v.cdp;
    });
  return fields;
}

function applyNodeFieldsFromParsed(target: Record<string, unknown>, parsed: Record<string, unknown>): void {
  for (const [key, val] of Object.entries(parsed)) {
    if (NODE_FIELD_RE.test(key)) {
      target[key] = Number(val) || 0;
    }
  }

  if (Array.isArray(parsed.nodes)) {
    for (const node of parsed.nodes as Array<Record<string, unknown>>) {
      const idx = Number(node.index ?? node.node ?? node.number ?? node.nodeNumber);
      if (!idx || Number.isNaN(idx)) continue;
      const charges = Number(node.charges ?? node.monthlyCharges ?? node.nodeCharges ?? 0) || 0;
      const cdp = Number(node.cdp ?? node.cdpCharges ?? node.nodeCdp ?? 0) || 0;
      const chargesKey = `node${idx}Charges`;
      const cdpKey = `node${idx}Cdp`;
      target[chargesKey] = (Number(target[chargesKey]) || 0) + charges;
      target[cdpKey] = (Number(target[cdpKey]) || 0) + cdp;
    }
  }
}

function sumNodeFieldValues(data: Record<string, unknown>): number {
  let sum = 0;
  for (const [key, val] of Object.entries(data)) {
    if (NODE_FIELD_RE.test(key)) sum += Number(val) || 0;
  }
  return sum;
}

function normalizeParsedE2E(parsed: Record<string, unknown>): ExtractedE2EInvoiceData {
  const normalized: Record<string, unknown> = {
    vendorName: parsed.vendorName || 'E2E Networks',
    invoiceNumber: parsed.invoiceNumber || `E2E-${Date.now().toString().slice(-6)}`,
    invoiceDate: parsed.invoiceDate ? new Date(String(parsed.invoiceDate)) : null,
    billingPeriod: parsed.billingPeriod ?? null,
    billingMonth: parsed.billingMonth ?? null,
    currency: normalizeCurrency(String(parsed.currency ?? 'INR')),
    backupAgentCharges: Number(parsed.backupAgentCharges) || 0,
    storageBackups: Number(parsed.storageBackups) || 0,
    savedImages: Number(parsed.savedImages) || 0,
    snapshots: Number(parsed.snapshots) || 0,
    totalCostInr: 0,
    totalCostUsd: 0,
  };

  applyNodeFieldsFromParsed(normalized, parsed);
  return normalized as ExtractedE2EInvoiceData;
}

// Coordinate E2E OCR extraction
export async function extractE2EInvoiceData(
  fileBuffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ExtractedE2EInvoiceData> {
  let result: Partial<ExtractedE2EInvoiceData> | null = null;

  // 1. Try Gemini Multimodal AI
  try {
    result = await processE2EGeminiMultimodalOCR(fileBuffer, mimeType, filename);
  } catch (err: any) {
    console.error('[E2E OCR] Gemini parse failed, falling back to local text parser:', err.message || err);
  }

  // 2. Fallback to Local PDF Parse
  if (!result && mimeType === 'application/pdf') {
    try {
      result = await processE2ELocalPDFFallback(fileBuffer, filename);
    } catch (err: any) {
      console.error('[E2E OCR] Local PDF parse failed, using mock data:', err.message || err);
    }
  }

  if (!result) {
    throw new Error(
      'Could not extract E2E invoice data. Upload a readable PDF or configure GEMINI_API_KEY.'
    );
  }

  // Ensure dynamic billingMonth check
  if (!result.billingMonth) {
    // 1. Try from billingPeriod
    if (result.billingPeriod) {
      const period = result.billingPeriod;
      const monthMatch = period.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s-]*(\d{2,4})/i);
      if (monthMatch) {
        const mName = monthMatch[1].slice(0, 3);
        const mTitle = mName.charAt(0).toUpperCase() + mName.slice(1).toLowerCase();
        const yStr = monthMatch[2].slice(-2);
        result.billingMonth = `${mTitle}-${yStr}`;
      } else {
        const parts = period.split(/\s+to\s+|\s*-\s*/i);
        if (parts.length > 0) {
          const firstDateStr = parts[0].trim();
          let normalized = firstDateStr;
          const numericMatch = firstDateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
          if (numericMatch) {
            normalized = `${numericMatch[2]}/${numericMatch[1]}/${numericMatch[3]}`;
          }
          const d = new Date(normalized);
          if (!isNaN(d.getTime())) {
            const mShort = d.toLocaleString('en-US', { month: 'short' });
            const yShort = d.getFullYear().toString().slice(-2);
            result.billingMonth = `${mShort}-${yShort}`;
          }
        }
      }
    }

    // 2. Try from invoiceDate.
    // NOTE: Previous logic subtracted 1 month unconditionally. That breaks when invoiceDate
    // is already aligned to the billing month, or when date parsing differs by format/timezone.
    if (!result.billingMonth && result.invoiceDate) {
      const d = new Date(result.invoiceDate);
      if (!isNaN(d.getTime())) {
        const mShort = d.toLocaleString('en-US', { month: 'short' });
        const yShort = d.getFullYear().toString().slice(-2);
        result.billingMonth = `${mShort}-${yShort}`;
      }
    }

    // 3. Try from filename
    if (!result.billingMonth && filename) {
      const nameLow = filename.toLowerCase();
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      for (let i = 0; i < months.length; i++) {
        if (nameLow.includes(months[i])) {
          const mTitle = months[i].charAt(0).toUpperCase() + months[i].slice(1);
          const yearMatch = filename.match(/\b(20)?(25|26|27)\b/);
          const yStr = yearMatch ? yearMatch[2] : '26';
          result.billingMonth = `${mTitle}-${yStr}`;
          break;
        }
      }
    }
  }

  // Recalculate totals from all discovered node fields (not capped at 8)
  const bac = Number(result.backupAgentCharges) || 0;
  const stb = Number(result.storageBackups) || 0;
  const sim = Number(result.savedImages) || 0;
  const snp = Number(result.snapshots) || 0;

  const totalCalculated =
    sumNodeFieldValues(result as Record<string, unknown>) + bac + stb + sim + snp;
  const currency = normalizeCurrency(String(result.currency ?? ''));
  result.currency = currency;
  if (currency === 'USD') {
    result.totalCostUsd = totalCalculated;
    result.totalCostInr = toInr(totalCalculated, 'USD');
  } else {
    result.totalCostInr = totalCalculated;
    result.totalCostUsd = toUsd(totalCalculated, 'INR');
  }



  return result as ExtractedE2EInvoiceData;
}

// Gemini prompt extraction
async function processE2EGeminiMultimodalOCR(
  fileBuffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ExtractedE2EInvoiceData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }

  console.log(`[E2E OCR] Running Gemini Multimodal AI on ${filename}...`);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt = `You are an expert AI finance assistant.
Your task is to analyze the attached E2E Networks server invoice and extract the node charges and backup details.
Return a JSON object with these required fields:
{
  "vendorName": "E2E Networks",
  "invoiceNumber": "string",
  "invoiceDate": "YYYY-MM-DD or null",
  "billingPeriod": "string or null",
  "currency": "INR or USD — detect from invoice symbols (₹/INR vs $/USD)",
  "backupAgentCharges": number,
  "storageBackups": number,
  "savedImages": number,
  "snapshots": number
}

For EVERY compute node on the invoice (Node-1, Node-2, ... Node-N — include ALL nodes, do not stop at 8),
add dynamic fields "nodeXCharges" (monthly compute) and "nodeXCdp" (CDP backup) where X is the node number.

Example for 10 nodes: node1Charges, node1Cdp, ... node10Charges, node10Cdp.

Reference IPs for known nodes (use when node labels are unclear):
- Node-1: 164.52.204.208
- Node-2: 91.203.134.219
- Node-3: 216.48.180.14
- Node-4: 216.48.190.255
- Node-5: 164.52.215.3
- Node-6: 151.185.41.128
- Node-7: 151.185.42.78
- Node-8: 164.52.213.163
- Backup Agent: 216.48.184.189

Rules:
- For each node, extract Monthly Charges → nodeXCharges and CDP/backup charges → nodeXCdp.
- If new nodes appear beyond Node-8, continue numbering (node9Charges, node9Cdp, etc.).
- Map general storage for backups to "storageBackups", saved images to "savedImages", snapshots to "snapshots".
- Detect currency from the invoice: use "INR" if amounts are in ₹/INR/Rs, use "USD" if in $/USD/dollars. All charge amounts must be in that detected currency.
- If any node/agent or backup is not mentioned or has 0 cost, set it to 0.
- Return raw JSON in JSON mode.`;

  const filePart = {
    inlineData: {
      data: fileBuffer.toString('base64'),
      mimeType,
    },
  };

  const result = await model.generateContent([prompt, filePart]);
  const responseText = result.response.text();
  const parsed = JSON.parse(responseText);
  return normalizeParsedE2E(parsed);
}

// Local regex parser fallback
async function processE2ELocalPDFFallback(
  fileBuffer: Buffer,
  filename: string
): Promise<ExtractedE2EInvoiceData> {
  console.log(`[E2E OCR] Local PDF Text parse on ${filename}...`);
  
  const parser = new PDFParse({ data: fileBuffer });
  const textResult = await parser.getText();
  const text = textResult.text || '';
  await parser.destroy();

  const detectedCurrency = detectCurrencyFromText(text);

  // Try extracting invoice number
  let invoiceNumber = `E2E-${Date.now().toString().slice(-6)}`;
  const invMatch = text.match(/(?:invoice\s*number|invoice\s*#|inv\s*#)\s*[:#-]?\s*([a-zA-Z0-9-]+)/i);
  if (invMatch) invoiceNumber = invMatch[1].trim();

  // Extract Month & Year from E2E report header.
  // Supported formats:
  // - "Month : 01 , Year : 2026"
  // - "Month: Jan, Year: 2026" (month names)
  // - "Month : Jan , Year : 2026" (spacing variants)
  let billingMonth: string | null = null;
  let billingPeriod: string | null = null;
  let invoiceDate: Date | null = null;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNumberToShort = (mNum: number) => (mNum >= 1 && mNum <= 12 ? months[mNum - 1] : null);
  const monthNameToShort = (mName: string) => {
    const clean = mName.trim().slice(0, 3).toLowerCase();
    const idx = months.findIndex((m) => m.toLowerCase() === clean);
    return idx >= 0 ? months[idx] : null;
  };

  // 1) numeric month
  const monthYearMatch = text.match(/Month\s*:\s*(\d+)\s*,\s*Year\s*:\s*(\d+)/i);
  if (monthYearMatch) {
    const mNum = parseInt(monthYearMatch[1], 10);
    const yNum = parseInt(monthYearMatch[2], 10);
    const mShort = monthNumberToShort(mNum);
    if (mShort) {
      const yShort = yNum.toString().slice(-2);
      billingMonth = `${mShort}-${yShort}`;
      billingPeriod = `01-${mShort}-${yNum} to ${mNum === 2 ? (yNum % 4 === 0 ? 29 : 28) : [4, 6, 9, 11].includes(mNum) ? 30 : 31}-${mShort}-${yNum}`;
      invoiceDate = new Date(yNum, mNum - 1, 15);
    }
  }

  // 2) month name
  if (!billingMonth) {
    const monthNameYearMatch = text.match(/Month\s*:\s*([a-zA-Z]{3,9})\s*,\s*Year\s*:\s*(\d+)/i);
    if (monthNameYearMatch) {
      const mShort = monthNameToShort(monthNameYearMatch[1]);
      const yNum = parseInt(monthNameYearMatch[2], 10);
      if (mShort && !isNaN(yNum)) {
        const yShort = yNum.toString().slice(-2);
        billingMonth = `${mShort}-${yShort}`;
        // Best-effort billingPeriod; day count varies by month/year.
        const mIndex = months.findIndex((m) => m === mShort) + 1; // 1..12
        billingPeriod = `01-${mShort}-${yNum} to ${mIndex === 2 ? (yNum % 4 === 0 ? 29 : 28) : [4, 6, 9, 11].includes(mIndex) ? 30 : 31}-${mShort}-${yNum}`;
        invoiceDate = new Date(yNum, mIndex - 1, 15);
      }
    }
  }

  // General date fallback
  if (!invoiceDate) {
    const dateMatch = text.match(/(?:invoice\s*date|date\s*of\s*issue|issue\s*date)\s*[:#-]?\s*([a-zA-Z0-9 \t,/-]+)/i);
    if (dateMatch) {
      const parsedDate = Date.parse(dateMatch[1].trim());
      if (!isNaN(parsedDate)) invoiceDate = new Date(parsedDate);
    }
  }
  if (!invoiceDate) invoiceDate = new Date();

  // General billing period fallback
  if (!billingPeriod) {
    const periodMatch = text.match(/(?:billing\s*period|period|duration)\s*[:#-]?\s*([a-zA-Z0-9 \t,/-]+(?:\s+to\s+|\s*-\s*)[a-zA-Z0-9 \t,/-]+)/i);
    if (periodMatch) {
      billingPeriod = periodMatch[1].trim();
    } else {
      const simplePeriodMatch = text.match(/(?:billing\s*period|period|duration)\s*[:#-]?\s*([a-zA-Z0-9 \t,/-]+)/i);
      if (simplePeriodMatch) billingPeriod = simplePeriodMatch[1].trim();
    }
  }

  const nodeTotals = createNodeTotals();
  const ipToNode = new Map<string, number>(Object.entries(KNOWN_NODE_IPS).map(([ip, n]) => [ip, n]));
  let nextDynamicNode =
    Math.max(8, ...Object.values(KNOWN_NODE_IPS), ...[...ipToNode.values()]) + 1;

  const resolveNodeFromBlock = (lowBlock: string, block: string): number | null => {
    for (const [ip, n] of Object.entries(KNOWN_NODE_IPS)) {
      if (lowBlock.includes(ip)) return n;
    }

    const labelMatch = lowBlock.match(/node[\s-]*(\d+)/i);
    if (labelMatch) return parseInt(labelMatch[1], 10);

    const ipMatch = block.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
    if (ipMatch && ipMatch[1] !== BACKUP_AGENT_IP) {
      const ip = ipMatch[1];
      if (ipToNode.has(ip)) return ipToNode.get(ip)!;
      ipToNode.set(ip, nextDynamicNode);
      return nextDynamicNode++;
    }

    return null;
  };

  let backupAgentCharges = 0;
  let storageBackups = 0;
  let savedImages = 0;
  let snapshots = 0;

  // Split text by item categories to group description blocks with their total cost row
  const blocks = text.split(/(?=c3\.\d+gb|backup_agent_license|storage_for_backup|saved_image|snapshot)/i);

  blocks.forEach((block) => {
    const lowBlock = block.toLowerCase();

    const rowMatch = block.match(
      /default-project-\d+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i
    );
    if (!rowMatch) return;

    const value = parseFloat(rowMatch[4]);
    const isCdp =
      lowBlock.includes('cdp') || lowBlock.includes('backup') || lowBlock.includes('license');

    const nodeNum = resolveNodeFromBlock(lowBlock, block);
    if (nodeNum !== null) {
      addNodeAmount(nodeTotals, nodeNum, value, isCdp);
      return;
    }

    if (lowBlock.includes(BACKUP_AGENT_IP)) {
      backupAgentCharges += value;
    } else if (lowBlock.includes('storage_for_backup')) {
      storageBackups += value;
    } else if (lowBlock.includes('saved_image')) {
      savedImages += value;
    } else if (lowBlock.includes('snapshot')) {
      snapshots += value;
    }
  });

  return {
    vendorName: 'E2E Networks',
    invoiceNumber,
    invoiceDate,
    billingPeriod,
    billingMonth,
    currency: detectedCurrency,
    ...nodeTotalsToFields(nodeTotals),
    backupAgentCharges,
    storageBackups,
    savedImages,
    snapshots,
    totalCostInr: 0,
    totalCostUsd: 0,
  };
}

// Generate fallback mock values matching typical sizes
function processE2EMockExtraction(filename: string): ExtractedE2EInvoiceData {
  // Extract month indicator from name e.g. "Jan2026"
  let invoiceMonth = 'Jan-26';
  const nameLow = filename.toLowerCase();
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  for (let i = 0; i < months.length; i++) {
    if (nameLow.includes(months[i])) {
      invoiceMonth = `${months[i].charAt(0).toUpperCase() + months[i].slice(1)}-26`;
      break;
    }
  }

  // Generate mock costs (e.g. ~10,000 INR to ~15,000 INR per node)
  return {
    vendorName: 'E2E Networks',
    invoiceNumber: `E2E-MOCK-${Date.now().toString().slice(-6)}`,
    invoiceDate: new Date(),
    billingPeriod: `01-${invoiceMonth} - 31-${invoiceMonth}`,
    billingMonth: invoiceMonth,
    currency: 'INR',
    node1Charges: 12500.0,
    node1Cdp: 850.0,
    node2Charges: 9500.0,
    node2Cdp: 650.0,
    node3Charges: 9500.0,
    node3Cdp: 650.0,
    node4Charges: 9500.0,
    node4Cdp: 650.0,
    node5Charges: 5200.0,
    node5Cdp: 450.0,
    node6Charges: 9500.0,
    node6Cdp: 650.0,
    node7Charges: 9500.0,
    node7Cdp: 650.0,
    node8Charges: 9500.0,
    node8Cdp: 650.0,
    backupAgentCharges: 250.0,
    storageBackups: 1500.0,
    savedImages: 450.0,
    snapshots: 320.0,
    totalCostInr: 0,
    totalCostUsd: 0
  };
}
