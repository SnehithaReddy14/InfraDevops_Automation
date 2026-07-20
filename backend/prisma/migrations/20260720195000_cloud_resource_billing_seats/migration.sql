-- SaaS seat/agent tracking on infrastructure resources
ALTER TABLE "CloudResource" ADD COLUMN IF NOT EXISTS "billingSeats" INTEGER;
ALTER TABLE "CloudResource" ADD COLUMN IF NOT EXISTS "billingUnit" TEXT;
