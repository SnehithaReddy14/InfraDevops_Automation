/** Distinct environment tags on uploaded invoices (null = general billing, no env split). */
export function distinctInvoiceEnvironments(
  invoices: Array<{ environment?: string | null }>
): string[] {
  const set = new Set<string>();
  for (const inv of invoices) {
    const env = inv.environment?.trim();
    if (env) set.add(env);
  }
  return [...set].sort();
}

/** Show env filters / upload tagging only when invoices use more than one environment. */
export function usesInvoiceEnvironmentSplit(
  invoices: Array<{ environment?: string | null }>
): boolean {
  return distinctInvoiceEnvironments(invoices).length > 1;
}

/** Any invoice explicitly tagged with an environment. */
export function hasTaggedInvoiceEnvironments(
  invoices: Array<{ environment?: string | null }>
): boolean {
  return invoices.some((inv) => Boolean(inv.environment?.trim()));
}

export function formatInvoiceEnvironment(environment?: string | null): string {
  return environment?.trim() || '—';
}
