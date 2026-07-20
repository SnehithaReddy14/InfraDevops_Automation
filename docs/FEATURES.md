# Features Overview

Phase 1 feature set for **AWS Billing Automation** — invoice ingestion, project workspaces, infrastructure inventory, and data-driven billing analytics.

Last updated: July 2026

---

## Navigation (active UI)

| Area | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/dashboard` | KPIs, monthly spend chart, vendor chart, month × project billing matrix |
| **Projects** | `/projects` | Project list, create/edit workspace |
| **Project workspace** | `/projects/:id` | Overview, Infrastructure, Invoices, Billing tabs |
| **Invoice ledger** | `/invoices` | Cross-project invoice list, filters, bulk actions |
| **Invoice detail** | `/invoices/:id` | Side-by-side PDF review and edit |

---

## 1. Invoice upload & OCR

- Multi-file upload (PDF, PNG, JPEG) scoped to a project
- Parser routing by billing provider (`parserRouter.ts`):
  - **E2E Cloud** → `e2eOcrService.ts`
  - **Jira / Atlassian** → `jiraOcrService.ts` (subscription line extraction)
  - **Default** → `ocrService.ts` (Gemini, GCP Document AI, Textract, pdf-parse)
- Duplicate invoice number → `409 Conflict`
- Optional **environment tag** on upload when project uses multi-env billing
- Rich vendor fields stored in `Invoice.metadata`; totals on `Invoice` columns

See [specs/01_ai_ocr_extraction.md](specs/01_ai_ocr_extraction.md).

---

## 2. Invoice verification workspace

- Split-screen PDF preview + editable fields
- Line items grid (add, edit, delete rows)
- Real-time total calculation
- Status workflow: Draft → Pending Review → Approved / Rejected / Paid
- **Subscription invoices:** “Billed users & agents” summary cards and Seats/Unit columns when `metadata.subscriptionLines` is present

See [specs/02_verify_invoice_workspace.md](specs/02_verify_invoice_workspace.md).

---

## 3. Billing ledger

- Searchable invoice list with pagination
- Filters by status, vendor, date range
- Bulk delete and export actions

See [specs/03_billing_ledger.md](specs/03_billing_ledger.md).

---

## 4. Executive dashboard

- **3 KPI cards:** total invoices, total revenue, active projects
- **Monthly billing** area chart (all projects, last 12 months)
- **Top vendors** bar chart
- **Billing matrix:** months (rows) × projects (columns) — all projects from DB, no hardcoded names
- **Environment filter** shown only when invoices use more than one distinct environment tag
- Auto-refresh every 10s + on window focus

See [specs/04_monthly_spend_dashboard.md](specs/04_monthly_spend_dashboard.md).

---

## 5. Project workspace

Four tabs per project:

| Tab | Features |
|-----|----------|
| **Overview** | Metadata, spend summary, edit project |
| **Infrastructure** | CloudResource CRUD, dynamic resource forms, auto pricing lookup |
| **Invoices** | Project-scoped uploads and list |
| **Billing** | `DynamicBillingView`, discrepancy check panel |

### Environment-aware billing (optional)

- Projects with **plain billing** (no env tags) hide environment upload/filter UI
- When **2+ distinct env tags** exist on invoices, show env filter on upload, billing tab, and dashboard
- User can opt in to “Tag by environment” on upload

See [specs/07_enterprise_projects_management.md](specs/07_enterprise_projects_management.md).

---

## 6. Dynamic infrastructure forms

Forms adapt by **Cloud / Tool** and **Service / Resource Type** (`resourceTypes.ts`):

| Profile | Examples | Key fields |
|---------|----------|------------|
| `compute` | EC2, VM, Droplet | Instance type, vCPU, RAM, storage, IP, region |
| `database` | RDS, Cloud SQL | DB class, storage, region |
| `storage` | S3, Blob | Tier, capacity, region |
| `serverless` | Lambda, Functions | Memory tier, region |
| `usage` | SNS, ALB, Route53 | Name, cost, env, region |
| `saas` | Jira, Copilot | Seat / usage / storage models — see below |
| `container` | EKS, GKE | Cluster description, region |

### SaaS form deduplication

- **Specific products** (e.g. Copilot Business — per user): no separate Plan/SKU field; no region
- **Generic types** (e.g. Jira User License): Plan/tier field + billed seats
- **Usage SaaS** (GitHub Actions, Jira Automation): monthly cost only
- **Storage SaaS** (GitHub Packages, Storage Add-on): capacity (GB) + cost

Auto pricing via `GET /api/pricing/estimate` (AWS catalog → Gemini → heuristic).

See [specs/08_dynamic_resource_forms_and_pricing.md](specs/08_dynamic_resource_forms_and_pricing.md).

---

## 7. Dynamic billing view

- Built from uploaded invoices per project — **no hardcoded layouts or project names**
- First column always **Month** (never Bill Period)
- Columns discovered from line items and metadata
- FX metadata (`fxInrPerUsd`, etc.) excluded from cost columns; rate shown in subtitle when INR conversion applies
- Layouts: `monthly_summary`, `multi_product`, `category_matrix`, `resource_matrix`
- Multi-currency with Frankfurter FX API

See [specs/09_dynamic_billing_view.md](specs/09_dynamic_billing_view.md).

---

## 8. Billing discrepancy detection

Compares invoice line items + billable metadata against scoped `CloudResource` rows.

| Type | Meaning |
|------|---------|
| `unscoped_on_invoice` | Charge on bill, no matching resource (warning) |
| `scoped_not_on_invoice` | Resource in scope, not on invoices (info) |
| `cost_variance` | Name match but cost differs (info) |

API: `GET /api/projects/:id/billing-discrepancies`  
UI: Project → **Billing** tab → **Billing Discrepancy Check** panel

---

## 9. Supported cloud / SaaS tools

From `TOOLS_LIST`: AWS, Microsoft Azure, GCP, E2E Cloud, Jira, GitHub Copilot, Oracle Cloud, DigitalOcean, Custom / Other.

Each tool has a grouped service catalog in `RESOURCE_TYPES_BY_TOOL`.

---

## 10. Authentication & roles

- JWT bearer auth on protected API routes
- Roles: Admin, Finance Manager, Employee, Auditor
- JWT auth on API routes; dev auto-login via seed user (`admin@company.com`)

---

## Documentation index

| Doc | Topic |
|-----|-------|
| [DATABASE.md](DATABASE.md) | Schema & metadata |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design & APIs |
| [CODE_REFERENCE.md](CODE_REFERENCE.md) | File map |
| [PHASE1_STATUS.md](PHASE1_STATUS.md) | BRD checklist |
| [specs/00_architecture_overview.md](specs/00_architecture_overview.md) | End-to-end workflow |
