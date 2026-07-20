-- Tag invoices by environment (Production, Staging, QA, Development) for env-wise billing reports
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "environment" TEXT;
