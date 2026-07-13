import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/db';

export interface AssistantResponse {
  queryText: string;
  explanation: string;
  invoices: any[];
  summary: string;
  stats?: {
    count: number;
    total: number;
    average: number;
  };
}

// Simple rule-based parser fallback when Gemini API key is missing
function fallbackParseQuery(query: string): any {
  const q = query.toLowerCase();
  const result: any = {
    filters: {},
    aggregation: null,
    aggregationField: null,
    explanation: 'Parsed query using local pattern matching.',
  };

  // 1. Check status
  if (q.includes('pending') || q.includes('review')) {
    result.filters.status = 'PENDING_REVIEW';
    result.explanation += ' Filtered by status "PENDING_REVIEW".';
  } else if (q.includes('approved')) {
    result.filters.status = 'APPROVED';
    result.explanation += ' Filtered by status "APPROVED".';
  } else if (q.includes('paid')) {
    result.filters.status = 'PAID';
    result.explanation += ' Filtered by status "PAID".';
  } else if (q.includes('unpaid')) {
    result.filters.status = 'UNPAID';
    result.explanation += ' Filtered by status "UNPAID".';
  } else if (q.includes('rejected')) {
    result.filters.status = 'REJECTED';
    result.explanation += ' Filtered by status "REJECTED".';
  } else if (q.includes('draft')) {
    result.filters.status = 'DRAFT';
    result.explanation += ' Filtered by status "DRAFT".';
  }

  // 2. Check vendor/search terms
  if (q.includes('aws')) {
    result.filters.vendorName = { contains: 'AWS', mode: 'insensitive' };
    result.explanation += ' Filtered vendor name containing "AWS".';
  } else if (q.includes('vercel')) {
    result.filters.vendorName = { contains: 'Vercel', mode: 'insensitive' };
    result.explanation += ' Filtered vendor name containing "Vercel".';
  } else if (q.includes('google')) {
    result.filters.vendorName = { contains: 'Google', mode: 'insensitive' };
    result.explanation += ' Filtered vendor name containing "Google".';
  } else if (q.includes('stripe')) {
    result.filters.vendorName = { contains: 'Stripe', mode: 'insensitive' };
    result.explanation += ' Filtered vendor name containing "Stripe".';
  }

  // 3. Check amounts (e.g. "above 50000", "greater than 1000")
  const amountMatch = q.match(/(?:above|greater than|more than|>)\s*(?:₹|\$)?\s*([0-9,]+)/);
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!isNaN(amount)) {
      result.filters.grandTotal = { gt: amount };
      result.explanation += ` Filtered invoices with grand total greater than ${amount}.`;
    }
  }

  const belowMatch = q.match(/(?:below|less than|under|<)\s*(?:₹|\$)?\s*([0-9,]+)/);
  if (belowMatch) {
    const amount = parseFloat(belowMatch[1].replace(/,/g, ''));
    if (!isNaN(amount)) {
      result.filters.grandTotal = { lt: amount };
      result.explanation += ` Filtered invoices with grand total less than ${amount}.`;
    }
  }

  // 4. Check spend/aggregations
  if (q.includes('spend') || q.includes('how much') || q.includes('total') || q.includes('sum')) {
    result.aggregation = 'sum';
    result.aggregationField = 'grandTotal';
    result.explanation += ' Summarized total spend.';
  }

  // 5. Month filtering (June, etc.)
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  for (let i = 0; i < months.length; i++) {
    if (q.includes(months[i]) || q.includes(months[i].slice(0, 3))) {
      const year = new Date().getFullYear();
      const startDate = new Date(year, i, 1);
      const endDate = new Date(year, i + 1, 0, 23, 59, 59);
      result.filters.invoiceDate = {
        gte: startDate,
        lte: endDate,
      };
      result.explanation += ` Filtered invoices in ${months[i].charAt(0).toUpperCase() + months[i].slice(1)}.`;
      break;
    }
  }

  return result;
}

export async function askAssistant(query: string): Promise<AssistantResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  let parsedQuery: any;

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });

      const prompt = `
        You are an AI assistant designed to translate natural language queries about invoices into structured database filters.
        The database contains an "Invoice" table with the following relevant columns:
        - invoiceNumber (string)
        - invoiceDate (DateTime?)
        - dueDate (DateTime?)
        - vendorName (string?)
        - customerName (string?)
        - status (Enum: DRAFT, PENDING_REVIEW, APPROVED, REJECTED, PAID, UNPAID)
        - currency (string)
        - subtotal (Float)
        - tax (Float)
        - discount (Float)
        - shipping (Float)
        - grandTotal (Float)

        Convert the user query: "${query}"
        
        Output a JSON object exactly matching the schema below:
        {
          "filters": {
            "vendorName": { "contains": "string", "mode": "insensitive" } (optional),
            "status": "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "PAID" | "UNPAID" (optional),
            "grandTotal": { "gt": number, "lt": number } (optional),
            "invoiceDate": { "gte": "ISOString", "lte": "ISOString" } (optional),
            "invoiceNumber": { "contains": "string", "mode": "insensitive" } (optional)
          },
          "aggregation": "sum" | "count" | "average" | null,
          "aggregationField": "grandTotal" | null,
          "explanation": "A short description of the filter criteria applied."
        }

        Note:
        - "spend" or "cost" implies "sum" aggregation of grandTotal.
        - "invoices from June" means invoiceDate between June 1st and June 30th of the current year (2026).
        - "above ₹50,000" means grandTotal gt 50000.
        - Current local time is ${new Date().toISOString()}.
      `;

      const response = await model.generateContent(prompt);
      const responseText = response.response.text();
      parsedQuery = JSON.parse(responseText);
    } catch (error: any) {
      console.error('[Assistant] Gemini parser failed, falling back to pattern matcher:', error.message);
      parsedQuery = fallbackParseQuery(query);
    }
  } else {
    parsedQuery = fallbackParseQuery(query);
  }

  // Build the Prisma query
  const where: any = {};

  if (parsedQuery.filters) {
    if (parsedQuery.filters.status) {
      where.status = parsedQuery.filters.status;
    }
    if (parsedQuery.filters.vendorName) {
      where.vendorName = parsedQuery.filters.vendorName;
    }
    if (parsedQuery.filters.grandTotal) {
      where.grandTotal = parsedQuery.filters.grandTotal;
    }
    if (parsedQuery.filters.invoiceDate) {
      where.invoiceDate = {
        gte: parsedQuery.filters.invoiceDate.gte ? new Date(parsedQuery.filters.invoiceDate.gte) : undefined,
        lte: parsedQuery.filters.invoiceDate.lte ? new Date(parsedQuery.filters.invoiceDate.lte) : undefined,
      };
    }
    if (parsedQuery.filters.invoiceNumber) {
      where.invoiceNumber = parsedQuery.filters.invoiceNumber;
    }
  }

  // Fetch invoices matching criteria
  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { invoiceDate: 'desc' },
    take: 50, // Limit safety
  });

  // Calculate stats
  const count = invoices.length;
  const total = invoices.reduce((acc, curr) => acc + curr.grandTotal, 0);
  const average = count > 0 ? total / count : 0;

  // Generate natural language summary
  let summary = '';
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const dataSummaryPrompt = `
        You are an AI Finance Assistant.
        The user asked: "${query}"
        Our database filters found ${count} invoice(s) with a combined grand total of ${total.toFixed(2)} (average ${average.toFixed(2)}).
        Here is the brief list of matched records in JSON format:
        ${JSON.stringify(invoices.map(i => ({ number: i.invoiceNumber, vendor: i.vendorName, total: i.grandTotal, status: i.status, date: i.invoiceDate })))}

        Write a professional, friendly, and extremely concise summary (2-3 sentences) answering the user's query directly based on these records.
        Display monetary values in a readable currency format matching the query (e.g. ₹50,000 or $100).
      `;

      const summaryResponse = await model.generateContent(dataSummaryPrompt);
      summary = summaryResponse.response.text().trim();
    } catch (e: any) {
      console.error('[Assistant] Gemini summary generation failed, falling back...', e.message);
    }
  }

  // Fallback summary if Gemini is not available or failed
  if (!summary) {
    if (parsedQuery.aggregation === 'sum') {
      summary = `The total spend for these matches is ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })} across ${count} invoices.`;
    } else {
      summary = `I found ${count} invoice(s) matching your request. The combined total is ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`;
      if (count > 0) {
        summary += ` Recent invoices include ${invoices.slice(0, 3).map(i => `${i.invoiceNumber} from ${i.vendorName || 'Unknown'} (${i.grandTotal})`).join(', ')}.`;
      }
    }
  }

  return {
    queryText: query,
    explanation: parsedQuery.explanation || 'Processed query filters.',
    invoices,
    summary,
    stats: {
      count,
      total,
      average,
    },
  };
}
