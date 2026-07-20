# Enterprise Projects Management Specification

Project workspaces group invoices, infrastructure inventory, and dynamic billing views under a single client or engagement boundary.

---

## Overview

| Item | Location |
|------|----------|
| Projects list | `frontend/src/pages/Projects.tsx` |
| Project workspace | `frontend/src/pages/ProjectWorkspace.tsx` |
| Tool constants | `frontend/src/constants/tools.ts` |
| Resource types & profiles | `frontend/src/constants/resourceTypes.ts` |
| Projects controller | `backend/src/controllers/projectsController.ts` |
| Resources controller | `backend/src/controllers/resourcesController.ts` |

---

## REST API

### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List all projects with resource count & monthly cost aggregates |
| GET | `/api/projects/:id` | Single project by numeric ID |
| POST | `/api/projects` | Create workspace |
| PUT | `/api/projects/:id` | Update metadata |
| DELETE | `/api/projects/:id` | Cascade delete project, resources, invoices |

### Resources (CloudResource)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:id/resources` | List infrastructure nodes |
| POST | `/api/projects/:id/resources` | Add resource |
| PUT | `/api/projects/resources/:id` | Update resource |
| DELETE | `/api/projects/resources/:id` | Remove resource |

### Billing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:id/billing-view` | Dynamic billing grid from invoices |
| GET | `/api/projects/:id/billing-discrepancies` | Invoice vs infrastructure scope check |

All endpoints require JWT (`authenticateToken`).

---

## Data model

### Project

```prisma
model Project {
  id              Int
  name            String
  code            String   @unique   // auto-generated slug, e.g. "atg-scanner"
  description     String?
  owner           String
  businessUnit    String?
  status          String   @default("ACTIVE")
  costCenter      String?
  tags            String?
  billingProvider String   @default("AWS")  // primary tool for workspace
  awsAccount      String?
  resources       CloudResource[]
  invoices        Invoice[]
}
```

**Removed from project level** (now on each resource): `environment`, `region`, VPC/subnet fields from earlier designs.

### CloudResource

```prisma
model CloudResource {
  instanceName   String
  resourceType   String      // e.g. EC2, Copilot Business, User License
  instanceType   String?     // instance class OR plan/tier for generic SaaS
  vcpus          Int
  memory         Float
  storage        Float
  monthlyCost    Float
  billingSeats   Int?        // SaaS seat model
  billingUnit    String?     // users | agents | seats
  environment    String      @default("Production")
  region         String      @default("us-east-1")  // global for SaaS
  tool           String      @default("AWS")
  status         String      @default("RUNNING")
  publicIp       String?
}
```

---

## Feature: Projects dashboard

**File:** `Projects.tsx`

- KPI-style summary from aggregated project list
- Search by name, code, owner
- Filter by billing provider / tool
- Create modal fields: name, description, owner, business unit, cost center, status, **billing provider**
- **Auto-generated project code** from name on create (user does not type code)
- Row click navigates to `/projects/:id`
- Edit and delete actions on each row

---

## Feature: Project workspace tabs

**File:** `ProjectWorkspace.tsx`

### Overview tab
- Project metadata cards (owner, BU, cost center, billing provider)
- Edit project modal
- Quick stats: resource count, total monthly resource cost, invoice count

### Infrastructure tab
- Table columns adapt to resource mix:
  - **Compute:** vCPU, RAM, storage
  - **SaaS (seats):** Billed seats column when any seat-based resource exists
  - **Plan / tier:** column only when saved rows have `instanceType`
  - **Region:** column hidden when all resources use `global`
- **Add Resource** / **Edit** opens modal with dynamic fields (see [08_dynamic_resource_forms_and_pricing.md](./08_dynamic_resource_forms_and_pricing.md))
- Delete with confirmation

### Invoices tab
- Project-scoped invoice list with link to detail view
- Drag-and-drop upload with optional **environment tag** (only when project uses multi-env billing)

### Billing tab
- Summary cards: aggregated invoiced spend, active resource target cost, invoice count
- **`DynamicBillingView`** from `GET /api/projects/:id/billing-view`
- **`BillingDiscrepancyPanel`** from `GET /api/projects/:id/billing-discrepancies`
- Optional **environment filter** when invoices have 2+ distinct env tags

---

## Supported cloud / tools

From `TOOLS_LIST` in `constants/tools.ts`:

- AWS
- Microsoft Azure
- GCP
- E2E Cloud
- Jira
- GitHub Copilot
- Oracle Cloud
- DigitalOcean
- Custom / Other

Each tool has its own service list in `RESOURCE_TYPES_BY_TOOL` (`resourceTypes.ts`).

---

## Resource form behavior (summary)

When user changes **Service / Resource Type**:

1. `handleResourceTypeChange()` calls `applyProfileToFormFields()`
2. Irrelevant fields cleared (e.g. switching EC2 → SNS removes instance type, vCPU, RAM)
3. UI conditionally renders fields from `resourceProfile`

Profiles: `compute`, `container`, `database`, `storage`, `serverless`, `usage`, `saas`, `generic`.

**SaaS profile** uses per-type billing model:
- `seats` — Copilot Business, Jira User License (billed seats field; plan field only for generic types)
- `usage` — GitHub Actions, Jira Automation (cost only; no region)
- `storage` — GitHub Packages, Storage Add-on (capacity GB + cost)

**Usage profile** (SNS, SQS, ALB, Route53, NAT, WAF, KMS, …):
- Shows: name, tool, service, monthly cost, environment, region
- Hides: instance spec, vCPU, RAM, storage, IP

---

## Pricing integration

- **Auto lookup price** button calls `GET /api/pricing/estimate`
- Triggered on instance type / region / tool change (debounced) for compute/database profiles
- Manual cost edit sets `costManuallyEdited` flag to prevent overwrite
- Submit uses `parseResourceForm(form, profile)` to zero out hidden numeric fields

---

## Out of scope (Phase 1)

- Multi-step create wizard with VPC/subnet blueprint
- VM start/stop/reboot controls
- Live CPU/RAM telemetry charts
- Per-project environment/region at project level

Phase 1 focuses on inventory + invoice-driven billing inside the project workspace.
