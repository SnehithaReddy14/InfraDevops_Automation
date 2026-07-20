-- Step 1: Add new column before migrating data into it
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "billingGridJson" TEXT;

-- Step 2: Migrate invoice detail columns into metadata.details JSON
UPDATE "Invoice"
SET "metadata" = (
  COALESCE(NULLIF("metadata", '')::jsonb, '{}'::jsonb)
  || jsonb_build_object(
    'details',
    COALESCE(NULLIF("metadata", '')::jsonb -> 'details', '{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
      'dueDate', CASE WHEN "dueDate" IS NOT NULL THEN to_jsonb("dueDate"::text) END,
      'vendorAddress', "vendorAddress",
      'vendorEmail', "vendorEmail",
      'vendorPhone', "vendorPhone",
      'customerName', "customerName",
      'customerAddress', "customerAddress",
      'customerEmail', "customerEmail",
      'customerPhone', "customerPhone",
      'gstNumber', "gstNumber",
      'vatNumber', "vatNumber",
      'purchaseOrder', "purchaseOrder",
      'paymentTerms', "paymentTerms"
    ))
  )
)::text
WHERE
  "dueDate" IS NOT NULL
  OR "vendorAddress" IS NOT NULL
  OR "vendorEmail" IS NOT NULL
  OR "vendorPhone" IS NOT NULL
  OR "customerName" IS NOT NULL
  OR "customerAddress" IS NOT NULL
  OR "customerEmail" IS NOT NULL
  OR "customerPhone" IS NOT NULL
  OR "gstNumber" IS NOT NULL
  OR "vatNumber" IS NOT NULL
  OR "purchaseOrder" IS NOT NULL
  OR "paymentTerms" IS NOT NULL;

-- Step 3: Migrate ProjectBilling rows into Project.billingGridJson (only if table still exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ProjectBilling') THEN
    UPDATE "Project" p
    SET "billingGridJson" = sub.grid::text
    FROM (
      SELECT pb."projectCode", jsonb_object_agg(pb."month", pb."amount") AS grid
      FROM "ProjectBilling" pb
      GROUP BY pb."projectCode"
    ) sub
    WHERE lower(p."code") = lower(sub."projectCode");
  END IF;
END $$;

-- Step 4: Drop removed invoice columns
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "dueDate";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "vendorAddress";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "vendorEmail";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "vendorPhone";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "customerName";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "customerAddress";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "customerEmail";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "customerPhone";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "gstNumber";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "vatNumber";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "purchaseOrder";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "paymentTerms";

-- Step 5: Drop removed project infra columns
ALTER TABLE "Project" DROP COLUMN IF EXISTS "environment";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "region";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "vpc";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "subnets";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "availabilityZones";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "securityGroups";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "iamRole";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "keyPair";

-- Step 6: Drop invoice item tax columns
ALTER TABLE "InvoiceItem" DROP COLUMN IF EXISTS "gstRate";
ALTER TABLE "InvoiceItem" DROP COLUMN IF EXISTS "taxAmount";

-- Step 7: Drop legacy billing table
DROP TABLE IF EXISTS "ProjectBilling";

-- Step 8: Ensure project codes are unique
CREATE UNIQUE INDEX IF NOT EXISTS "Project_code_key" ON "Project"("code");
