# Billing Ledger Table Specification

The Billing Ledger is the central database workspace displaying a sortable and filterable table of all uploaded invoice documents.

## Overview

| Item | Location |
|------|----------|
| Frontend | `frontend/src/pages/InvoiceList.tsx` |
| API | `/api/invoices` in `invoiceController.ts` |

> **Note:** Status and payment badges exist in the ledger UI, but the dashboard no longer emphasizes approval/paid workflows — uploads are primarily tracked as saved invoices driving billing views.

## Feature Description

### 1. spacious Layout & Decent Alignment
- Main table uses a roomy grid with `py-5.5 px-5` spacing class to prevent congested row alignments.
- **Grand Total** is right-aligned to match accounting decimal layouts.
- Base text font sizes are formatted to a uniform **14px** (`text-sm`), and badges to a balanced **12px** (`text-xs`).

### 2. Custom Ledger Columns
- **Billing Period**: Displays the parsed billing month/year (e.g. `Jun 2026`) instead of raw upload dates.
- **Status**: Main verification workflow tag (`Draft`, `Pending Review`, `Approved`, `Rejected`).
- **Payment**: Dedicated payment lifecycle badge:
  - 🟢 `Paid` for paid status.
  - 🟠 `Unpaid` for approved but unpaid status.
  - ⚪ `—` (N/A) for drafts or rejected invoices.

### 3. Dynamic Currency Conversion
- Converts the original invoice total (e.g. USD) and formats it into the user's active **Default Ledger Currency** (e.g. ₹ INR) dynamically on the fly based on settings.

### 4. Advanced Filters & Searching
- Support live full-text search by invoice number or vendor name.
- Advanced filter drawers for:
  - Grand total thresholds (Min / Max amount).
  - Billing period dates.
  - Verification statuses.

### 5. Multi-Select & Bulk Actions
- Selection checkbox allows picking multiple invoices to run bulk actions:
  - **Approve / Reject** (for pending invoices).
  - **Mark Paid / Mark Unpaid** (only allowed for approved invoices).
  - **Delete** (permanently drops records from db).

### 6. Three-Dots Row Options
- Each table row hides action buttons behind a clean vertical three-dots icon button (`MoreVertical`).
- Clicking it opens an overlay options container with dynamic actions based on permissions and invoice status.

### 7. Export Panel
- Exporters allow downloading the active ledger list in multiple formats:
  - Excel sheet (`.xlsx`)
  - CSV (`.csv`)
  - PDF Summary reports
  - JSON Raw Data
