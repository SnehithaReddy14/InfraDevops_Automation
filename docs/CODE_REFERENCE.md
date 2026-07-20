# Code Reference

Quick map from feature area to source files. See [ARCHITECTURE.md](ARCHITECTURE.md) for diagrams and API details.

## Frontend (`frontend/src/`)

| Area | Files |
|------|-------|
| Routing | `App.tsx` |
| Auth | `context/AuthContext.tsx`, `context/useAuth.ts` (dev auto-login via `/api/auth/login`) |
| Dashboard | `pages/Dashboard.tsx` |
| Projects | `pages/Projects.tsx`, `pages/ProjectWorkspace.tsx` |
| Invoices | `pages/InvoiceList.tsx`, `pages/InvoiceDetail.tsx` |
| Dynamic billing UI | `components/DynamicBillingView.tsx` |
| Discrepancy UI | `components/BillingDiscrepancyPanel.tsx` |
| Resource catalog + form profiles | `constants/resourceTypes.ts` |
| Environment UX | `utils/environmentUtils.ts` |
| SaaS helpers | `utils/saasUtils.ts` |
| Tools & regions | `constants/tools.ts` |
| API client | `utils/api.ts` |

## Backend (`backend/src/`)

| Area | Files |
|------|-------|
| Entry | `index.ts` |
| Auth | `routes/auth.ts`, `controllers/authController.ts`, `middleware/auth.ts` |
| Invoices + dashboard stats | `routes/invoices.ts`, `controllers/invoiceController.ts` |
| Projects + billing-view + discrepancies | `routes/projects.ts`, `controllers/projectsController.ts` |
| Resources | `controllers/resourcesController.ts` |
| Pricing | `routes/pricing.ts`, `controllers/pricingController.ts`, `services/pricingService.ts` |
| OCR | `services/parserRouter.ts`, `ocrService.ts`, `e2eOcrService.ts`, `jiraOcrService.ts` |
| Billing view builder | `services/billingViewService.ts` |
| Discrepancy matching | `services/discrepancyService.ts` |
| Invoice environment | `utils/invoiceEnvironment.ts` |
| SaaS line items | `utils/saasUtils.ts` |
| Currency / FX | `utils/currencyUtils.ts`, `services/exchangeRateService.ts` |
| Invoice API enrichment | `utils/invoiceDetails.ts` |
| DB | `utils/db.ts`, `prisma/schema.prisma` |

## Key API responses

| Endpoint | Key fields |
|----------|------------|
| `GET /api/invoices/dashboard-stats` | `metrics`, `charts`, `billingMatrix`, `distinctInvoiceEnvironments` |
| `GET /api/projects/:id/billing-view` | `BillingView` — `columns`, `rows`, `layout`, `chartData` |
| `GET /api/projects/:id/billing-discrepancies` | `items[]` with `type`, `severity`, `message` |
| `GET /api/pricing/estimate` | `monthlyCostUsd`, `source`, `note` |

## Form profiles (`resourceTypes.ts`)

`getResourceFormProfile(tool, resourceType)` →  
`compute | container | database | storage | serverless | usage | saas | generic`

## Database models (6 tables)

`User`, `Project`, `CloudResource`, `Invoice`, `InvoiceItem`, `Attachment`

Full reference: [DATABASE.md](DATABASE.md)

## Scripts

| Script | Purpose |
|--------|---------|
| `backend/prisma/seed.ts` | Demo admin user |
