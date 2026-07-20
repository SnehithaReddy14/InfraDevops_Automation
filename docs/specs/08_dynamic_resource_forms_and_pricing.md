# Dynamic Resource Forms & Pricing Specification



Infrastructure add/edit forms adapt field visibility and validation based on the selected **Cloud / Tool** and **Service / Resource Type**. Monthly cost can be auto-estimated via the pricing API.



---



## Overview



| Item | Location |

|------|----------|

| Resource type catalog | `frontend/src/constants/resourceTypes.ts` |

| Form UI | `frontend/src/pages/ProjectWorkspace.tsx` (resource modal) |

| Pricing service | `backend/src/services/pricingService.ts` |

| Pricing API | `backend/src/controllers/pricingController.ts` |

| Route | `GET /api/pricing/estimate` |



---



## Resource type catalog



`RESOURCE_TYPES_BY_TOOL` maps each tool to grouped service options:



```typescript

type SaasBillingModel = 'seats' | 'usage' | 'storage';



interface ResourceTypeOption {

  value: string;          // stored in CloudResource.resourceType

  label: string;          // display label

  group?: string;         // Compute | Database | SaaS | …

  needsPlanTier?: boolean;   // SaaS: show Plan/tier field

  saasBilling?: SaasBillingModel;  // SaaS: which extra fields to show

}

```



Helpers:

- `getResourceTypesForTool(tool)` — dropdown options

- `getDefaultResourceTypeForTool(tool)` — first option on tool change

- `saasResourceTypeNeedsPlanField(tool, resourceType)` — avoids duplicate Plan/SKU when product is in type label

- `isSaasResource(tool, resourceType)` — true when seat billing applies



---



## Form profiles



`getResourceFormProfile(tool, resourceType)` returns a `ResourceFormProfile`:



```typescript

interface ResourceFormProfile {

  id: 'compute' | 'container' | 'database' | 'storage' | 'serverless' | 'usage' | 'saas' | 'generic';

  showInstanceSpec: boolean;

  showVcpus: boolean;

  showMemory: boolean;

  showStorage: boolean;

  showBillingSeats: boolean;

  showIp: boolean;

  showRegion: boolean;

  instanceSpecLabel: string;   // e.g. "Plan / tier" for generic SaaS

  pricingHint: string;

  specRequiredForLookup: boolean;

}

```



### Profile resolution (`resolveProfileId`)



| Condition | Profile |

|-----------|---------|

| Lambda, Functions, Cloud Run, App Engine | `serverless` |

| SaaS group, license, subscription, copilot | `saas` |

| Storage group or S3/Blob/Spaces | `storage` |

| Database group | `database` |

| Integration, Networking, Security, Management | `usage` |

| Compute + EKS/ECS/GKE/Kubernetes | `container` |

| Compute (default) | `compute` |

| Unknown | `generic` |



### Field matrix



| Profile | Instance spec | vCPU | RAM | Storage | Seats | IP | Region |

|---------|---------------|------|-----|---------|-------|-----|--------|

| compute | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |

| container | ✓ (cluster) | — | — | — | — | — | ✓ |

| database | ✓ (DB class) | — | — | ✓ | — | — | ✓ |

| storage | ✓ (tier) | — | — | ✓ | — | — | ✓ |

| serverless | ✓ (memory) | — | ✓ | — | — | — | ✓ |

| **usage** | — | — | — | — | — | — | ✓ |

| **saas (seats)** | plan if generic | — | — | — | ✓ | — | — |

| **saas (usage)** | — | — | — | — | — | — | — |

| **saas (storage)** | — | — | — | ✓ | — | — | — |

| generic | ✓ (optional) | — | — | — | — | — | ✓ |



---



## SaaS form deduplication



When the **Service / Resource Type** already names the product/plan, do not show a separate Plan field.



| Example type | Plan/tier field | Billed seats | Region |

|--------------|-----------------|--------------|--------|

| Copilot Business — per user | Hidden | Shown | Hidden |

| Jira User License | Shown (Standard, Premium) | Shown | Hidden |

| GitHub Actions — CI/CD minutes | Hidden | Hidden | Hidden |

| GitHub Packages — storage | Hidden | Hidden | Hidden (storage GB shown) |

| Jira Premium / Enterprise Support | Hidden | Hidden | Hidden |



Auto lookup uses `resourceType` as the spec when Plan field is hidden.



---



## Form state & UX



### String-backed numeric fields



vCPU, RAM, storage, seats, and monthly cost use **string state** while editing. Parsed to numbers only on submit via `parseResourceForm()`.



### Change handlers



- `handleToolChange(tool)` — resets resource type, applies profile, clears stale fields

- `handleResourceTypeChange(type)` — applies profile via `applyProfileToFormFields()` (clears hidden fields including `billingSeats`)

- Edit modal open — `applyProfileToFormFields()` strips hidden values from loaded DB row



---



## Submit & validation



```typescript

parseResourceForm(form, profile) → {

  instanceType: profile.showInstanceSpec ? form.instanceType : '',

  vcpus, memory, storage: zeroed when profile hides field,

  billingSeats, billingUnit: set only when showBillingSeats,

  region: 'global' when !showRegion,

  monthlyCost: parseFloat(form.monthlyCost) || 0,

}

```



---



## Pricing API



```

GET /api/pricing/estimate?tool=GitHub Copilot&resourceType=Copilot Business&region=global&...

```



Estimation order: SaaS/usage detection → AWS catalog → Gemini → usage note → heuristic (compute only).



---



## Example: Copilot Business



User selects:

- Tool: **GitHub Copilot**

- Service: **Copilot Business — per user**

- Billed seats: **46**

- Monthly cost: from invoice or Auto lookup



Result:

- Profile: `saas` / `seats`

- Visible: name, tool, service, seats, cost, environment

- Hidden: Plan/SKU, region, vCPU, RAM, storage

- Saved: `billingSeats=46`, `billingUnit=users`, `region=global`



---



## Example: SNS resource



User selects:

- Tool: **AWS**

- Service: **SNS — Notifications**



Result:

- Profile: `usage`

- Visible: name, tool, service, monthly cost, environment, region

- Saved row: `vcpus=0`, `memory=0`, `storage=0`, `instanceType=''`



---



## Example: EC2 resource



- Profile: `compute`

- All spec fields + region + optional IP

- Auto lookup from AWS catalog when instance type set


