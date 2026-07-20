# Phase 1 Status — AWS Billing Automation

Last updated: July 2026

## Navigation model

| Area | Route |
|------|-------|
| **Dashboard** | `/dashboard` |
| **Projects** | `/projects`, `/projects/:id` |
| **Invoice ledger** | `/invoices`, `/invoices/:id` |

Core flows: upload invoices → parse → project billing matrix → infrastructure scope → discrepancy check.

---

## BRD Phase 1 checklist

### Done

| Item | Notes |
|------|-------|
| PostgreSQL schema (6 tables) | `billingSeats`, `billingUnit` on `CloudResource`; `environment` on `Invoice` |
| Invoice upload & OCR parsing | E2E, Jira subscription lines, generic Gemini/Textract |
| Project workspace | Overview, Infrastructure, Invoices, Billing tabs |
| Dynamic resource forms | Per-tool profiles + SaaS seat/usage/storage models |
| SaaS form deduplication | No redundant Plan/SKU or region for specific products |
| Dynamic billing view | Data-driven columns; FX metadata excluded from grids |
| Dashboard billing matrix | Months × projects, dynamic from DB |
| Optional environment split | Env UI only when 2+ tagged envs on invoices |
| Billing discrepancy detection | API + Billing tab panel |
| Subscription seats on invoices | `subscriptionLines` in metadata + InvoiceDetail UI |
| Lean navigation | Dashboard + Projects only; legacy pages/APIs removed |

### In progress / partial

| Item | Gap |
|------|-----|
| SQLite → Supabase migration | Ops validation pending |
| Reconciliation sign-off | Pending migration + manual validation |
| Legacy OCR mock fallbacks | `ocrService.ts` demo paths — cleanup optional |
| Row 19 UI/UX polish | Ongoing per design sheet |

### Not started (post–Phase 1 or ops)

| Item | Notes |
|------|-------|
| GitHub push / CI pipeline | User-driven |
| Automated discrepancy tests | Optional unit tests for `discrepancyService` |

---

## Key APIs (Phase 1)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/invoices/dashboard-stats` | KPIs + billing matrix + distinct envs |
| GET | `/api/projects/:id/billing-view` | Dynamic billing spreadsheet |
| GET | `/api/projects/:id/billing-discrepancies` | Invoice vs infrastructure scope |
| GET | `/api/projects/:id/resources` | Scoped cloud resources |
| GET | `/api/pricing/estimate` | Resource monthly cost lookup |

---

## Discrepancy detection

Compares **billed services** (invoice line items + numeric metadata keys) against **scoped resources** (`CloudResource`).

| Type | Meaning |
|------|---------|
| `unscoped_on_invoice` | Charge on bill, no matching resource — **warning** |
| `scoped_not_on_invoice` | Resource in scope, not seen on invoices — info |
| `cost_variance` | Name match but billed vs scoped monthly cost differs — info |

UI: **Project → Billing tab → Billing Discrepancy Check** panel.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [DATABASE.md](DATABASE.md) | Schema reference |
| [FEATURES.md](FEATURES.md) | Feature overview |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design |

---

## Next recommended steps

1. Run PostgreSQL migration reconciliation against legacy totals.
2. Re-upload Jira invoices missing `subscriptionLines` metadata if seat UI is needed.
3. Add integration tests for discrepancy matching edge cases.
4. Complete UI/UX items from requirement sheet row 19.
