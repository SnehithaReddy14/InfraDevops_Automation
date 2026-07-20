import { prisma } from './db';

/** Resolve invoice IDs matching an optional environment tag (uses DB column via raw SQL). */
export async function invoiceIdsForEnvironment(
  environment: string | undefined | null,
  projectId?: number
): Promise<number[] | null> {
  const env = typeof environment === 'string' ? environment.trim() : '';
  if (!env) return null;

  if (projectId != null) {
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Invoice"
      WHERE "projectId" = ${projectId} AND "environment" = ${env}
    `;
    return rows.map((r) => r.id);
  }

  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM "Invoice" WHERE "environment" = ${env}
  `;
  return rows.map((r) => r.id);
}

export async function persistInvoiceEnvironment(invoiceId: number, environment: string | null) {
  if (!environment?.trim()) return;
  await prisma.$executeRaw`
    UPDATE "Invoice" SET "environment" = ${environment.trim()} WHERE "id" = ${invoiceId}
  `;
}

/** Distinct non-empty environment tags across all invoices (for dashboard filter visibility). */
export async function distinctInvoiceEnvironments(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ environment: string }[]>`
    SELECT DISTINCT "environment" AS environment FROM "Invoice"
    WHERE "environment" IS NOT NULL AND TRIM("environment") <> ''
    ORDER BY "environment" ASC
  `;
  return rows.map((r) => r.environment);
}

export function readEnvironmentFromMetadata(metadata: string | null): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as { environment?: string };
    return parsed.environment?.trim() || null;
  } catch {
    return null;
  }
}
