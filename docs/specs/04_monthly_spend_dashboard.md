# Monthly Spend Dashboard Specification

The **Executive Ledger** dashboard aggregates cross-project spend, vendor trends, and a **month × project billing matrix**. There are no invoice lifecycle charts (paid/pending/status pie).

---

## Overview

| Item | Location |
|------|----------|
| Frontend | `frontend/src/pages/Dashboard.tsx` |
| API | `GET /api/invoices/dashboard-stats` in `invoiceController.ts` |
| Refresh | TanStack Query — 10s interval + `refetchOnWindowFocus` |

---

## KPI cards (3)

| Card | Source |
|------|--------|
| Total Invoices | Count of all invoices |
| Total Revenue | Sum of billable invoices in default currency |
| Active Projects | `prisma.project.count()` |

**Removed from UI:** Paid Invoices, Saved Invoices, Pending Review, Status Allocation pie chart, Recent Invoices list.

Uploads are treated as saved; no approval workflow on the dashboard.

---

## Charts

### Monthly Billing (area chart)
- All projects combined, grouped by billing month
- Uses `billingMonth` first, else parsed `billingPeriod` / `invoiceDate`
- Last 12 months, chronological

### Top Vendor Spend (bar chart)
- Top 5 vendors by converted spend

---

## Billing matrix (pivot table)

**Months on the left (rows), projects on top (columns).**

```
              │  Jira  │  ATG   │  E2E   │ Total
──────────────┼────────┼────────┼────────┼──────
Mar-26        │  $789  │   —    │   —    │  $789
Jun-26        │   —    │  $546  │  $789  │ $1,335
──────────────┼────────┼────────┼────────┼──────
Total         │  $789  │  $546  │  $789  │ $2,070
```

| Behavior | Detail |
|----------|--------|
| Column headers | **Every project** in DB (`prisma.project.findMany`) — new projects appear as new columns immediately |
| Row labels | Billing month from each invoice |
| Cell value | Sum of `grandTotal` (currency-converted) for that project + month |
| Empty cell | `—` when no invoices |
| Sticky column | Month column stays visible on horizontal scroll |
| Links | Project header → `/projects/:id` |
| Env filter | Shown when API returns `distinctInvoiceEnvironments.length > 1` |

Matrix is built server-side in `getDashboardStats` — not hardcoded project names or month lists.

---

## API response

```json
{
  "metrics": {
    "totalInvoices": 11,
    "totalRevenue": 6510,
    "projectCount": 3,
    "uniqueVendors": 4
  },
  "charts": {
    "monthlyRevenue": [{ "name": "Jun-26", "value": 1335 }],
    "vendorSpending": [{ "name": "Atlassian Jira", "value": 2448 }]
  },
  "distinctInvoiceEnvironments": ["Production", "Staging"],
  "billingMatrix": {
    "projects": [
      { "id": 1, "name": "Jira", "code": "jira" }
    ],
    "months": [
      {
        "month": "Jun-26",
        "cells": [
          { "projectId": 1, "amount": 0 },
          { "projectId": 2, "amount": 546 }
        ],
        "rowTotal": 1335
      }
    ],
    "columnTotals": [{ "projectId": 1, "amount": 2448 }],
    "grandTotal": 6510
  }
}
```

---

## Currency conversion

- Query: `?defaultCurrency=USD|INR|EUR|GBP`
- INR from Frankfurter API (`exchangeRateService`) with env fallback
- All matrix cells and charts converted before response

---

## Billable statuses

Included in totals: `SAVED`, `SCANNED`, `PENDING_REVIEW`, `APPROVED`, `PAID`, `UNPAID`.  
Excluded: `DRAFT`, `REJECTED`.
