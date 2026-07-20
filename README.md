# AWS Billing Automation

Enterprise invoice and cloud billing platform for uploading vendor bills, extracting data with AI/OCR, managing projects and infrastructure inventory, and building dynamic billing views from real invoice data.

## What this project does

### Invoice automation
- Upload invoice PDFs and images (multi-file, project-scoped)
- Route parsing by billing provider (AWS, E2E Cloud, Jira, generic)
- Extract fields via Gemini, GCP Document AI, AWS Textract, or local fallback
- Review and edit extracted values in the invoice workspace
- Browse invoices in a billing ledger with filters and bulk actions
- Dashboard with spend trends, vendor breakdowns, and a **month × project billing matrix**

### Project & infrastructure management
- Create workspaces per client/project with auto-generated project codes
- Track cloud resources across **AWS, Azure, GCP, E2E, Jira, Copilot, Oracle, DigitalOcean, Custom**
- **Dynamic resource forms** — fields adapt by service type (e.g. SNS shows cost/region only, EC2 shows instance/vCPU/RAM)
- **Auto pricing lookup** — AWS catalog, Gemini, or usage-based hints via `/api/pricing/estimate`
- CRUD for infrastructure nodes linked to each project

### Dynamic billing
- Build spreadsheet-style billing grids from uploaded invoices (**no hardcoded layouts or project names**)
- **Project billing tab:** Month column + cost columns discovered from line items / metadata (FX keys excluded)
- **Executive dashboard:** Month × project pivot matrix (all projects as columns)
- **Optional environment filter** when invoices use multiple env tags
- Multi-currency with live INR/USD FX (Frankfurter API)
- **Billing discrepancy check:** compare invoice charges vs scoped infrastructure
- `DynamicBillingView` in project workspace; `billingMatrix` on dashboard

### SaaS & subscription billing
- Jira/Atlassian parser extracts `subscriptionLines` (product, seats, amount)
- Invoice detail shows billed users/agents; infra form supports seat-based SaaS resources
- Copilot/Jira forms avoid duplicate Plan/SKU fields when product is in resource type

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Framer Motion, Recharts |
| Backend | Express, TypeScript, Prisma ORM |
| Database | PostgreSQL (Supabase-compatible) |
| AI/OCR | Gemini, GCP Document AI, AWS Textract, vendor parsers (E2E, Jira), pdf-parse fallback |
| FX | Frankfurter exchange-rate API with cached fallback |

## Project structure

```
AWS-Billing-Automation/
├── frontend/
│   ├── src/pages/           # Route screens (Dashboard, Projects, ProjectWorkspace, …)
│   ├── src/components/      # DynamicBillingView, Sidebar, …
│   └── src/constants/       # resourceTypes.ts (tools + form profiles), tools.ts
├── backend/
│   ├── src/controllers/     # auth, invoices, projects, resources, pricing, …
│   ├── src/services/        # ocrService, billingViewService, pricingService, …
│   ├── src/routes/          # Express route mounts
│   └── prisma/schema.prisma # 6-table schema
└── docs/                    # Architecture + feature specs
```

## Quick start

1. Install dependencies in `backend` and `frontend`.
2. Set `DATABASE_URL` and optional AI keys in `backend/.env`.
3. Run `npx prisma generate && npx prisma db push && npx prisma db seed`.
4. Start backend (`npm run dev`) and frontend (`npm run dev`).

See [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for full setup.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/FEATURES.md](docs/FEATURES.md) | Phase 1 feature overview |
| [docs/DATABASE.md](docs/DATABASE.md) | PostgreSQL schema & metadata |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, data model, API map |
| [docs/CODE_REFERENCE.md](docs/CODE_REFERENCE.md) | File-to-feature map |
| [docs/PHASE1_STATUS.md](docs/PHASE1_STATUS.md) | BRD checklist & status |
| [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) | Local dev setup |
| [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md) | Demo walkthrough |
| [docs/specs/00_architecture_overview.md](docs/specs/00_architecture_overview.md) | End-to-end workflow |
| [docs/specs/01_ai_ocr_extraction.md](docs/specs/01_ai_ocr_extraction.md) | OCR pipeline |
| [docs/specs/02_verify_invoice_workspace.md](docs/specs/02_verify_invoice_workspace.md) | Invoice review UI |
| [docs/specs/03_billing_ledger.md](docs/specs/03_billing_ledger.md) | Invoice list & filters |
| [docs/specs/04_monthly_spend_dashboard.md](docs/specs/04_monthly_spend_dashboard.md) | Dashboard metrics |
| [docs/specs/07_enterprise_projects_management.md](docs/specs/07_enterprise_projects_management.md) | Projects & workspace |
| [docs/specs/08_dynamic_resource_forms_and_pricing.md](docs/specs/08_dynamic_resource_forms_and_pricing.md) | Resource form profiles & pricing |
| [docs/specs/09_dynamic_billing_view.md](docs/specs/09_dynamic_billing_view.md) | Invoice-driven billing grids |
| [docs/specs/architecture_workflow.svg](docs/specs/architecture_workflow.svg) | Visual architecture diagram |

## Demo credentials

Dev mode auto-logs in on startup. After seeding, the API user is:

- Email: `admin@company.com`
- Password: `password123`
