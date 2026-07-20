# Dynamic Billing View Specification

Billing spreadsheets are **generated from uploaded invoices** per project. Column headers, row keys, and layout type are inferred from invoice line items and metadata — **not** from tool names, project names, or hardcoded vendor templates.

---

## Overview

| Item | Location |
|------|----------|
| View builder | `backend/src/services/billingViewService.ts` |
| Currency helpers | `backend/src/utils/currencyUtils.ts` |
| FX service | `backend/src/services/exchangeRateService.ts` |
| API handler | `projectsController.getProjectBillingView` |
| Frontend renderer | `frontend/src/components/DynamicBillingView.tsx` |
| Workspace integration | `ProjectWorkspace.tsx` → **Billing** tab |

---

## API

```
GET /api/projects/:id/billing-view
Authorization: Bearer <token>
```

Builds from all `Invoice` rows where `projectId = :id`:

| Source | Used for |
|--------|----------|
| `Invoice.billingMonth`, `invoiceDate` | Row label (**Month** column) |
| `Invoice.grandTotal`, `currency` | Totals |
| `Invoice.metadata`, `extractedJson` | Discovered cost columns |
| `InvoiceItem[]` | Line-item product columns |

---

## Table rules (all layouts)

1. **First column is always `Month`** — never Invoice Date, never Bill Period.
2. **Cost columns only** — no billing-period sub-columns.
3. **Dynamic column headers** from invoice data (see discovery below).
4. **Totals row** at the bottom when the layout supports it.
5. Empty numeric cells render as `—` in the UI.

Example (GitHub Copilot / multi-line-item invoices):

| Month | GitHub Team Plan - Month | GitHub Copilot Usage | Invoice Total |
|-------|--------------------------|----------------------|---------------|
| Jan-26 | $20.00 | $705.00 | $833.00 |
| Feb-26 | $20.00 | $682.44 | $810.44 |

---

## Layout auto-detection

`detectLayout(invoices, metas)` uses **data shape only** — no checks on `tool`, `billingProvider`, or vendor name.

| Layout | Condition | Builder |
|--------|-----------|---------|
| `resource_matrix` | Metadata has `node{N}Charges` / `node{N}Cdp` or charge/backup/image keys | `buildResourceMatrix` |
| `multi_product` | Multiple distinct `InvoiceItem.description` values | `buildMultiProduct` |
| `category_matrix` | Multiple numeric cost fields in metadata | `buildCategoryMatrix` |
| `monthly_summary` | Default — one total per month | `buildMonthlySummary` |

Priority: resource patterns → line items → metadata fields → summary fallback.

If a builder finds no columns (e.g. no line items), it falls back to `buildMonthlySummary`.

---

## Column discovery

### Line items (`discoverLineItemColumns`)

- Reads `InvoiceItem.description` across all project invoices.
- Slugifies for column keys; **label = original description text**.
- Used by `multi_product` (Copilot, multi-SKU AWS bills, etc.).

### Metadata costs (`discoverMetadataCostColumns`)

- Scans numeric keys in parsed metadata (skips totals, dates, vendor fields).
- **Excludes FX/currency metadata** via `isBillableMetadataKey()` — keys like `fxInrPerUsd` never become columns.
- Respects optional parser hints:
  - `metadata.billingColumns`: `[{ key, label }]`
  - `metadata.columnLabels`: `{ key: "Display Name" }`
- Otherwise labels are **humanized from keys**.
- Used by `category_matrix` (Jira-style breakdowns, etc.).

### Resource groups (`discoverResourceGroups`)

- Finds `node1Charges`, `node1Cdp`, `backupAgentCharges`, etc. from metadata keys.
- Group/metric labels humanized from keys — no fixed E2E label map.

---

## BillingView response shape

```typescript
type BillingViewLayout =
  | 'monthly_summary'
  | 'category_matrix'
  | 'resource_matrix'
  | 'multi_product';

interface BillingView {
  projectName: string;
  tool: string;
  layout: BillingViewLayout;
  currency: string;
  title: string;
  subtitle?: string;
  columns: BillingColumn[];   // { key, label, type: 'text' | 'currency' }
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number | null>;
  chartData?: { month: string; amount: number }[];
  panels?: BillingViewPanel[];  // optional E2E node breakdown sub-grid
  fxInrPerUsd?: number;
}
```

---

## Multi-currency

When invoices mix INR and USD:

1. `buildCurrencyContext()` sets `hasInr` / `hasUsd`.
2. Native amount column + optional **USD** summary column.
3. Live rate from Frankfurter API (`GET /api/exchange-rate`), fallback `FX_INR_PER_USD`.

---

## Frontend (`DynamicBillingView.tsx`)

- Renders columns from API response (grouped headers when `column.group` is set).
- Monthly trend bar chart from `chartData`.
- Project workspace billing tab also shows KPI cards: invoiced spend, resource target cost, invoice count.

---

## Parser metadata guidance

Parsers should persist breakdown data so the view builder can discover columns:

### E2E (`e2eOcrService`)
```json
{
  "billingMonth": "Jun-25",
  "node1Charges": 1200,
  "node1Cdp": 150,
  "backupAgentCharges": 80
}
```

### Jira (`jiraOcrService`)
```json
{
  "billingMonth": "Mar-26",
  "subscriptionLines": [
    { "product": "Jira Service Management", "seatCount": 7, "billingUnit": "agents", "amount": 500 },
    { "product": "Jira Software", "seatCount": 46, "billingUnit": "users", "amount": 1200 }
  ]
}
```
Legacy numeric keys (`itsmUsersCost`, etc.) may still appear; prefer `subscriptionLines` for new uploads.
Optional: `"columnLabels": { "itsmUsersCost": "Jira Service Management" }`

### GitHub Copilot / multi-SKU
Store line items on `InvoiceItem` with descriptions from the PDF — columns come from descriptions automatically.

### Generic AWS
Usually `monthly_summary` (one column = project name) unless line items or metadata expose multiple cost fields.

---

## Not hardcoded (by design)

- Project names as column headers
- Jira field names (ITSM / Developers / Tempo)
- GitHub / Copilot / AWS tool routing
- Bill Period columns
- FX exchange rate as a cost column (`fxInrPerUsd` excluded)
- Fixed month lists or demo project rows

---

## Billing discrepancy detection (implemented)

**API:** `GET /api/projects/:id/billing-discrepancies`  
**Service:** `discrepancyService.ts`  
**UI:** `BillingDiscrepancyPanel` on project Billing tab

Compares invoice line items + billable metadata keys against `CloudResource` rows scoped to the project. FX/currency metadata excluded from “unscoped on invoice” matching.

| Type | Severity |
|------|----------|
| `unscoped_on_invoice` | Warning — charge on bill, no resource |
| `scoped_not_on_invoice` | Info — resource not seen on invoices |
| `cost_variance` | Info — matched name, different monthly cost |
