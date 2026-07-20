# Setup Guide

Full-stack billing automation with React frontend, Express backend, and Prisma + **PostgreSQL**.

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL database (local, Docker, or Supabase)

## 1. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
JWT_SECRET="your-secret-key"
PORT=5000

# Optional — improves OCR quality
GEMINI_API_KEY=

# Optional — GCP Document AI
GCP_PROJECT_ID=
GCP_LOCATION=
GCP_PROCESSOR_ID=
GCP_CLIENT_EMAIL=
GCP_PRIVATE_KEY=

# Optional — AWS Textract
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# Optional — FX fallback (live rate fetched from Frankfurter API)
FX_INR_PER_USD=83.5
```

Generate client and apply schema:

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Backend runs at http://localhost:5000.

Health check: http://localhost:5000/health

## 2. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173.

Ensure the frontend API base URL points to the backend (see `frontend/src/utils/api.ts`).

## 3. Authentication (dev)

The app auto-authenticates on load using the seed user:

- Email: `admin@company.com`
- Password: `password123`

## 4. Parser routing by billing provider

When uploading invoices, the project's **billing provider** selects the parser:

| Provider | Parser |
|----------|--------|
| E2E Cloud | `e2eOcrService.ts` |
| Jira | `jiraOcrService.ts` |
| Other | `ocrService.ts` (generic) |

Without cloud credentials, the backend falls back to Gemini (if keyed) or local `pdf-parse` heuristics.

## 5. Useful commands

```bash
# Backend production build
cd backend && npm run build

# Frontend production build
cd frontend && npm run build

# Refresh Prisma client after schema change
cd backend && npx prisma generate
```

## 6. Troubleshooting

### Prisma EPERM on Windows

Stop the backend, delete `backend/node_modules/.prisma/client`, then run `npx prisma generate`.

### Empty billing view

Upload at least one invoice linked to the project. The billing tab builds from invoice metadata — see [specs/09_dynamic_billing_view.md](specs/09_dynamic_billing_view.md).

### Pricing returns $0 for SNS/SQS

Expected for usage-based services. Enter expected monthly spend manually or configure `GEMINI_API_KEY` for AI estimates.

## 7. Documentation index

- [ARCHITECTURE.md](ARCHITECTURE.md) — system design
- [specs/00_architecture_overview.md](specs/00_architecture_overview.md) — workflows
- [specs/08_dynamic_resource_forms_and_pricing.md](specs/08_dynamic_resource_forms_and_pricing.md) — resource forms
- [specs/09_dynamic_billing_view.md](specs/09_dynamic_billing_view.md) — billing grids
