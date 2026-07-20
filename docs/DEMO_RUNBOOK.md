# Demo Runbook

Use this flow for a short live demo of the product.

## Suggested 5-minute demo

1. **Open app** — dev mode auto-authenticates as seed user (`admin@company.com` / `password123`)
2. **Projects** — show workspace list; create or open a project (code auto-generated)
3. **Upload** — attach a vendor PDF to that project; note parser routing by billing provider
4. **Invoice detail** — side-by-side preview; edit fields if needed; save
5. **Project → Billing tab** — show dynamic grid: **Month** + cost columns from the invoice (no hardcoded layout)
6. **Dashboard** — KPIs, monthly chart, vendor chart, **month × project matrix** (new projects appear as columns)
7. **Infrastructure tab** — add a resource; switch SNS vs Copilot to show dynamic form fields; optional auto pricing
8. **Billing discrepancy** — run scope check on Billing tab (invoice vs infra)

## Talking points

- Billing grids and dashboard matrix are built from **uploaded invoice data**, not hardcoded templates
- One platform for AWS, E2E, Jira, Copilot, and other providers
- Infrastructure inventory with service-aware forms (SNS ≠ EC2 fields)
- Multi-currency with live FX when mixing INR and USD

## Demo tips

- Use at least **two projects** with invoices in different months — dashboard matrix is most impressive with multiple columns
- For Copilot/Jira demos, upload real PDFs so line items populate column headers automatically
- If AI keys are missing, local PDF fallback still extracts basic fields

## Related docs

- [04_monthly_spend_dashboard.md](specs/04_monthly_spend_dashboard.md)
- [09_dynamic_billing_view.md](specs/09_dynamic_billing_view.md)
- [07_enterprise_projects_management.md](specs/07_enterprise_projects_management.md)
