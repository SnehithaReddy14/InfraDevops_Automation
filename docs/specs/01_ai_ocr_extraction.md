# AI OCR Document Extraction Specification

The AI OCR Extraction feature parses uploaded invoice documents (PDFs and images) and extracts billing fields using vendor-specific parsers, cloud APIs, or a local fallback engine.

## Overview
- **Parser router**: `backend/src/services/parserRouter.ts` — selects E2E, Jira, or generic parser by billing provider
- **Generic OCR**: `backend/src/services/ocrService.ts`
- **E2E parser**: `backend/src/services/e2eOcrService.ts`
- **Jira parser**: `backend/src/services/jiraOcrService.ts`
- **Controller**: `POST /api/invoices/upload` in `backend/src/controllers/invoiceController.ts`
- **Frontend**: `frontend/src/pages/ProjectWorkspace.tsx` (Invoices tab) and `InvoiceList.tsx`

## Parser routing

```typescript
parseInvoiceByProvider(buffer, mimeType, filename, provider)
```

| Provider value | Parser | Notes |
|----------------|--------|-------|
| `E2E Cloud` / `e2e` | `e2eOcrService` | Node breakdown, INR/USD, billing month |
| `Jira` | `jiraOcrService` | Product/month grids |
| Default | `ocrService` | Gemini / GCP / Textract / pdf-parse |

Structured vendor data is stored in `Invoice.metadata` (JSON) for dynamic billing views.

## Feature Description

### 1. Document Upload
- Invoices are uploaded as file attachments using `multipart/form-data`.
- Backend uses `multer` to write files to `backend/uploads/`.
- Frontend may pass `defaultCurrency` from browser `localStorage` in the upload request as a fallback when OCR cannot detect currency.

### 2. Extraction Pipeline
The backend executes one of three extraction engines based on credentials configured in env variables:
1. **Google Cloud Document AI (Processor v1)**: Primary enterprise model mapping entities such as totals, dates, and item rows.
2. **AWS Textract (AnalyzeExpense API)**: Alternate fallback mapping standard document fields and line item properties.
3. **Local Text Extractor Fallback**: Uses `pdf-parse` for text extraction and applies regex matching to parse details locally without external API dependencies.

### 3. Extracted Fields
*   `invoiceNumber`: Target invoice code (e.g. `INV-2026-001`).
*   `vendorName`: Extracted billing merchant name.
*   `billingPeriod`: Specific month or interval extracted from the bill headers.
*   `invoiceDate` & `dueDate`: Primary billing dates.
*   `grandTotal`, `subtotal`, `tax`, `discount`, `shipping`: Standard billing amounts.
*   `currency`: Extracted currency code (USD, INR, EUR, GBP), falling back to client's Default Ledger Currency if not found.
*   `confidenceScore`: AI extraction confidence level.
*   `lineItems`: List of parsed rows mapping descriptions and prices.

### 4. Duplicate Upload Prevention
- Before persisting the extracted data, the backend queries:
  ```typescript
  prisma.invoice.findFirst({ where: { invoiceNumber: extractedData.invoiceNumber } })
  ```
- If a match is found, the backend returns a `409 Conflict` error and deletes the uploaded temporary file to prevent double-billing entries.
