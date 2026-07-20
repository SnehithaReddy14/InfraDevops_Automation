# Verify Invoice Workspace Specification

The Verify Invoice Workspace is a split-screen layout designed for finance managers and admin users to review, correct, and verify OCR-extracted invoice details side-by-side with the original document.

## Overview

| Item | Location |
|------|----------|
| Frontend Page | `frontend/src/pages/InvoiceDetail.tsx` |
| Controller | `/api/invoices/:id` (GET, PUT) in `invoiceController.ts` |

## Feature Description

### 1. Dual-Pane Split-Screen View
*   **Left Pane (Document Preview)**: Displays the uploaded PDF or image using an `iframe` or `img` tag. Includes client-side controls for:
    *   Zoom in/out.
    *   Clockwise rotation (90° increments).
    *   File download.
*   **Right Pane (Metadata Form Editor)**: Lists all extracted fields grouped in interactive card containers (Vendor Details, Customer Details, Line Items Ledger, and Calculations Grid).

### 2. Form Field Auditing
*   Every input field shows color highlights:
    *   🟢 **Green** indicates fields that match original OCR extractions.
    *   🟡 **Amber** indicates modified values not yet saved.
*   Changes are tracked locally in `modifiedFields` state. Clicking "Reset" discards changes, and "Save Details" persists to PostgreSQL via Prisma.

### 3. Line Items Ledger Editor
*   Users can interactively manage the line items grid:
    *   Edit item descriptions and prices.
    *   Add new items dynamically ("Add Row").
    *   Duplicate existing rows.
    *   Delete invalid items.
*   **Subscription invoices:** when `metadata.subscriptionLines` is present (Jira/Atlassian SaaS), the UI shows **Billed users & agents** summary cards and optional Seats/Unit columns on line items.

### 4. Calculations Grid
*   Computes subtotal and grand totals dynamically in real-time on the client side:
    ```typescript
    subtotal = sum(unitPrices)
    grandTotal = subtotal - discount + tax + shipping
    ```
*   Provides a select dropdown to modify the invoice currency (INR, USD, EUR, GBP).

### 5. Verification State Toggles
*   If the user has manager/admin permissions, and the invoice is `Pending Review`, they can:
    *   **Approve**: Approves the invoice, changing its state to `Approved` and making it eligible for payments.
    *   **Reject**: Flags the invoice as `Rejected`.
*   The top header status badge displays the active lifecycle step (e.g. `Pending Review`, `Approved`, `Rejected`) in title case format.
