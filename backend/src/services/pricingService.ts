import { GoogleGenerativeAI } from '@google/generative-ai';

const HOURS_PER_MONTH = 730;
const EBS_GB_MONTH_USD = 0.08; // gp3 us-east-1 baseline

/** On-demand Linux hourly USD in us-east-1 (public list prices, approximate). */
const AWS_EC2_HOURLY_USD: Record<string, number> = {
  't2.micro': 0.0116,
  't2.small': 0.023,
  't2.medium': 0.0464,
  't2.large': 0.0928,
  't3.micro': 0.0104,
  't3.small': 0.0208,
  't3.medium': 0.0416,
  't3.large': 0.0832,
  't3.xlarge': 0.1664,
  't3.2xlarge': 0.3328,
  't3a.micro': 0.0094,
  't3a.small': 0.0188,
  't3a.medium': 0.0376,
  't3a.large': 0.0752,
  'm5.large': 0.096,
  'm5.xlarge': 0.192,
  'm5.2xlarge': 0.384,
  'm5.4xlarge': 0.768,
  'm6i.large': 0.096,
  'm6i.xlarge': 0.192,
  'c5.large': 0.085,
  'c5.xlarge': 0.17,
  'c5.2xlarge': 0.34,
  'r5.large': 0.126,
  'r5.xlarge': 0.252,
  'db.t3.micro': 0.017,
  'db.t3.small': 0.034,
  'db.t3.medium': 0.068,
  'db.t3.large': 0.136,
  'db.t3.xlarge': 0.272,
  'db.m5.large': 0.171,
  'db.m5.xlarge': 0.342,
  'cache.t3.micro': 0.017,
  'cache.t3.small': 0.034,
  'cache.t3.medium': 0.068,
  'cache.m5.large': 0.156,
};

/** Azure Linux pay-as-you-go hourly USD (approx, US regions). */
const AZURE_VM_HOURLY_USD: Record<string, number> = {
  'standard_b1s': 0.0104,
  'standard_b1ms': 0.0207,
  'standard_b2s': 0.0416,
  'standard_b2ms': 0.0832,
  'standard_b4ms': 0.166,
  'standard_d2s_v3': 0.096,
  'standard_d4s_v3': 0.192,
  'standard_d8s_v3': 0.384,
  'standard_d2s_v5': 0.096,
  'standard_d4s_v5': 0.192,
};

/** GCP on-demand hourly USD (us-central1 approx). */
const GCP_MACHINE_HOURLY_USD: Record<string, number> = {
  'e2-micro': 0.0084,
  'e2-small': 0.0168,
  'e2-medium': 0.0335,
  'e2-standard-2': 0.067,
  'e2-standard-4': 0.134,
  'n1-standard-1': 0.0475,
  'n1-standard-2': 0.095,
  'n1-standard-4': 0.19,
  'n2-standard-2': 0.097,
  'n2-standard-4': 0.194,
};

/** E2E Cloud monthly USD (approx public plans). */
const E2E_VM_MONTHLY_USD: Record<string, number> = {
  c3: 12,
  'c3.8gb': 18,
  'c3.16gb': 36,
  'c3.32gb': 72,
  'c3.64gb': 144,
  'c5.8gb': 22,
  'c5.16gb': 44,
  'c5.32gb': 88,
  m3: 10,
  'm3.8gb': 16,
  'm3.16gb': 32,
  'm3.32gb': 64,
};

/** DigitalOcean droplet flat monthly USD. */
const DO_DROPLET_MONTHLY_USD: Record<string, number> = {
  's-1vcpu-1gb': 6,
  's-1vcpu-2gb': 12,
  's-2vcpu-2gb': 18,
  's-2vcpu-4gb': 24,
  's-4vcpu-8gb': 48,
  's-8vcpu-16gb': 96,
  c2: 42,
  'c-2': 42,
  'c-4': 84,
  'c-8': 168,
};

/** Storage $/GB/month by service type keyword. */
const STORAGE_GB_MONTH_USD: Record<string, number> = {
  s3: 0.023,
  glacier: 0.004,
  ebs: 0.08,
  efs: 0.3,
  blob: 0.018,
  'cloud storage': 0.02,
  spaces: 0.02,
  'object storage': 0.023,
  'block storage': 0.08,
  'persistent disk': 0.08,
  'managed disk': 0.05,
  volumes: 0.1,
};

const REGION_FACTOR: Record<string, number> = {
  'us-east-1': 1,
  'us-east-2': 1,
  'us-west-1': 1.05,
  'us-west-2': 1,
  'eu-west-1': 1.1,
  'eu-central-1': 1.12,
  'ap-south-1': 1.05,
  'ap-southeast-1': 1.08,
  'ap-northeast-1': 1.15,
  global: 1,
};

export interface PricingEstimateInput {
  tool: string;
  resourceType: string;
  instanceType?: string;
  instanceName?: string;
  region?: string;
  vcpus?: number;
  memory?: number;
  storage?: number;
}

export interface PricingEstimateResult {
  monthlyCostUsd: number;
  source: 'aws_catalog' | 'provider_catalog' | 'gemini' | 'heuristic';
  note: string;
  breakdown?: {
    computeUsd?: number;
    storageUsd?: number;
  };
}

function normalizeKey(raw?: string): string {
  return (raw || '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeInstanceType(raw?: string): string {
  return (raw || '').trim().toLowerCase();
}

function regionFactor(region?: string): number {
  if (!region || region === 'global') return 1;
  return REGION_FACTOR[region] ?? 1.08;
}

function lookupHourlyCatalog(
  catalog: Record<string, number>,
  instanceType: string
): number | undefined {
  const key = normalizeInstanceType(instanceType);
  if (catalog[key] !== undefined) return catalog[key];
  const compact = key.replace(/[_\s-]+/g, '');
  for (const [k, v] of Object.entries(catalog)) {
    if (k.replace(/[_\s-]+/g, '') === compact) return v;
  }
  return undefined;
}

function lookupMonthlyCatalog(
  catalog: Record<string, number>,
  instanceType: string
): number | undefined {
  const key = normalizeInstanceType(instanceType);
  if (catalog[key] !== undefined) return catalog[key];
  const compact = key.replace(/[.\s_-]+/g, '');
  for (const [k, v] of Object.entries(catalog)) {
    if (k.replace(/[.\s_-]+/g, '') === compact) return v;
  }
  return undefined;
}

/** Parse cluster specs like "3 nodes × m5.large" or "3x m5.large". */
function parseClusterSpec(raw?: string): { nodeCount: number; instanceType: string } | null {
  const text = (raw || '').trim();
  if (!text) return null;
  const match =
    text.match(/(\d+)\s*(?:nodes?|×|x)\s*([a-z0-9][a-z0-9.-]*)/i) ||
    text.match(/(\d+)\s*[x×]\s*([a-z0-9][a-z0-9.-]*)/i);
  if (!match) return null;
  const nodeCount = Math.max(1, parseInt(match[1], 10) || 1);
  const instanceType = match[2].trim().toLowerCase();
  return { nodeCount, instanceType };
}

function estimateFromHourlyCatalog(
  catalog: Record<string, number>,
  input: PricingEstimateInput,
  providerLabel: string
): PricingEstimateResult | null {
  const cluster = parseClusterSpec(input.instanceType);
  const instanceType = cluster?.instanceType || normalizeInstanceType(input.instanceType);
  if (!instanceType) return null;

  const hourly = lookupHourlyCatalog(catalog, instanceType);
  if (hourly === undefined) return null;

  const nodes = cluster?.nodeCount ?? 1;
  const factor = regionFactor(input.region);
  const computeUsd = hourly * HOURS_PER_MONTH * factor * nodes;
  const storageGb = Math.max(0, Number(input.storage) || 0);
  const storageUsd = storageGb * EBS_GB_MONTH_USD * factor;
  const monthlyCostUsd = Math.round((computeUsd + storageUsd) * 100) / 100;

  return {
    monthlyCostUsd,
    source: 'provider_catalog',
    note: `Estimated from ${providerLabel} public list price (${input.instanceType || instanceType}, ${input.region || 'default region'}).`,
    breakdown: {
      computeUsd: Math.round(computeUsd * 100) / 100,
      storageUsd: Math.round(storageUsd * 100) / 100,
    },
  };
}

function estimateFromAwsCatalog(input: PricingEstimateInput): PricingEstimateResult | null {
  const cluster = parseClusterSpec(input.instanceType);
  const instanceType = cluster?.instanceType || normalizeInstanceType(input.instanceType);
  if (!instanceType) return null;

  const hourly = lookupHourlyCatalog(AWS_EC2_HOURLY_USD, instanceType);
  if (hourly === undefined) return null;

  const nodes = cluster?.nodeCount ?? 1;
  const factor = regionFactor(input.region);
  const computeUsd = hourly * HOURS_PER_MONTH * factor * nodes;
  const storageGb = Math.max(0, Number(input.storage) || 0);
  const storageUsd = storageGb * EBS_GB_MONTH_USD * factor;
  const monthlyCostUsd = Math.round((computeUsd + storageUsd) * 100) / 100;

  return {
    monthlyCostUsd,
    source: 'aws_catalog',
    note: `Estimated from AWS public on-demand list price (${input.instanceType || instanceType}, ${input.region || 'us-east-1'}).`,
    breakdown: {
      computeUsd: Math.round(computeUsd * 100) / 100,
      storageUsd: Math.round(storageUsd * 100) / 100,
    },
  };
}

function storageRateForResource(resourceType: string, instanceType?: string): number {
  const combined = `${resourceType} ${instanceType || ''}`.toLowerCase();
  for (const [keyword, rate] of Object.entries(STORAGE_GB_MONTH_USD)) {
    if (combined.includes(keyword)) return rate;
  }
  if (/s3|object|blob|spaces|glacier|archive/.test(combined)) return 0.023;
  if (/disk|volume|block|ebs|persistent/.test(combined)) return 0.08;
  return 0.023;
}

function estimateFromStorage(input: PricingEstimateInput): PricingEstimateResult | null {
  const storageGb = Math.max(0, Number(input.storage) || 0);
  if (storageGb <= 0) return null;

  const rate = storageRateForResource(input.resourceType, input.instanceType);
  const factor = regionFactor(input.region);
  const storageUsd = storageGb * rate * factor;
  const monthlyCostUsd = Math.round(storageUsd * 100) / 100;

  if (monthlyCostUsd <= 0) return null;

  return {
    monthlyCostUsd,
    source: 'provider_catalog',
    note: `Estimated from ${storageGb} GB storage at ~$${rate.toFixed(3)}/GB-month (${input.resourceType}).`,
    breakdown: { storageUsd: monthlyCostUsd },
  };
}

function estimateFromE2ECatalog(input: PricingEstimateInput): PricingEstimateResult | null {
  const instanceType = normalizeInstanceType(input.instanceType);
  if (!instanceType) return null;

  const monthly = lookupMonthlyCatalog(E2E_VM_MONTHLY_USD, instanceType);
  if (monthly === undefined) return null;

  const storageGb = Math.max(0, Number(input.storage) || 0);
  const storageUsd = storageGb * 0.05;
  const monthlyCostUsd = Math.round((monthly + storageUsd) * 100) / 100;

  return {
    monthlyCostUsd,
    source: 'provider_catalog',
    note: `Estimated from E2E Cloud plan pricing (${input.instanceType}).`,
    breakdown: {
      computeUsd: monthly,
      storageUsd: Math.round(storageUsd * 100) / 100,
    },
  };
}

function estimateFromDigitalOcean(input: PricingEstimateInput): PricingEstimateResult | null {
  const instanceType = normalizeInstanceType(input.instanceType);
  if (!instanceType) return null;

  const monthly = lookupMonthlyCatalog(DO_DROPLET_MONTHLY_USD, instanceType);
  if (monthly === undefined) return null;

  const storageGb = Math.max(0, Number(input.storage) || 0);
  const extraStorage = Math.max(0, storageGb - 25) * 0.1;
  const monthlyCostUsd = Math.round((monthly + extraStorage) * 100) / 100;

  return {
    monthlyCostUsd,
    source: 'provider_catalog',
    note: `Estimated from DigitalOcean droplet pricing (${input.instanceType}).`,
    breakdown: {
      computeUsd: monthly,
      storageUsd: Math.round(extraStorage * 100) / 100,
    },
  };
}

function parseSeatCount(text?: string): number | null {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(?:users?|seats?|licenses?|agents?)/i);
  if (match) return Math.max(1, parseInt(match[1], 10));
  return null;
}

function isSaasLikeResource(resourceType: string): boolean {
  return /saas|license|subscription|user license|cloud subscription|app\/plugin|copilot/i.test(
    resourceType.toLowerCase()
  );
}

function estimateHeuristic(input: PricingEstimateInput): PricingEstimateResult {
  const vcpus = Math.max(1, Number(input.vcpus) || 1);
  const memory = Math.max(1, Number(input.memory) || 1);
  const storageGb = Math.max(0, Number(input.storage) || 0);
  const factor = regionFactor(input.region);

  const cluster = parseClusterSpec(input.instanceType);
  const nodeMultiplier = cluster?.nodeCount ?? 1;

  const computeUsd = (vcpus * 12 + memory * 2) * factor * nodeMultiplier;
  const storageUsd = storageGb * EBS_GB_MONTH_USD * factor;
  const monthlyCostUsd = Math.round((computeUsd + storageUsd) * 100) / 100;

  return {
    monthlyCostUsd,
    source: 'heuristic',
    note: 'Rough estimate from vCPU/RAM/storage — verify against your provider console or upload an invoice.',
    breakdown: {
      computeUsd: Math.round(computeUsd * 100) / 100,
      storageUsd: Math.round(storageUsd * 100) / 100,
    },
  };
}

async function estimateWithGemini(input: PricingEstimateInput): Promise<PricingEstimateResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `You are a cloud pricing assistant. Estimate the typical MONTHLY cost in USD for this infrastructure resource running 24/7 (730 hours/month), on-demand pricing, no reserved instances.

Provider/Tool: ${input.tool}
Resource name: ${input.instanceName || 'n/a'}
Resource type: ${input.resourceType}
Instance/spec type: ${input.instanceType || 'unknown'}
Region: ${input.region || 'us-east-1'}
vCPUs: ${input.vcpus ?? 'unknown'}
RAM GB: ${input.memory ?? 'unknown'}
Storage GB: ${input.storage ?? 0}

Use your knowledge of current public cloud list prices (AWS, Azure, GCP, E2E Cloud, DigitalOcean, Jira, etc. as applicable).
Return ONLY JSON: {"monthlyCostUsd": number, "note": "short explanation"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    const monthlyCostUsd = Number(parsed.monthlyCostUsd);

    if (Number.isNaN(monthlyCostUsd) || monthlyCostUsd < 0) return null;

    return {
      monthlyCostUsd: Math.round(monthlyCostUsd * 100) / 100,
      source: 'gemini',
      note: String(parsed.note || 'AI estimate via Google Gemini — verify against your actual bill.'),
    };
  } catch (err) {
    console.warn('[Pricing] Gemini estimate failed:', err);
    return null;
  }
}

function isUsageOrSaaSResource(resourceType: string): boolean {
  const rt = resourceType.toLowerCase();
  const usageKeywords = [
    'sns', 'sqs', 'gateway', 'eventbridge', 'step functions', 'route53', 'cloudfront',
    'alb', 'nlb', 'nat', 'vpn', 'waf', 'kms', 'cloudwatch', 'monitor', 'dns',
    'load balancer', 'cdn', 'front door', 'pub/sub', 'service bus', 'license',
    'subscription', 'copilot', 'athena', 'glue', 'firewall', 'floating ip',
  ];
  return usageKeywords.some((k) => rt.includes(k));
}

function isDatabaseResource(resourceType: string): boolean {
  const rt = resourceType.toLowerCase();
  return /rds|database|sql|postgres|mysql|redis|cache|mongo|document|aurora|spanner|bigtable|dynamo|cosmos|autonomous|managed database|memorystore|firestore/.test(
    rt
  );
}

function isStorageResource(resourceType: string): boolean {
  const rt = resourceType.toLowerCase();
  return /s3|storage|blob|disk|volume|ebs|efs|glacier|spaces|object|filestore|backup|cdp/.test(rt);
}

function isComputeResource(resourceType: string): boolean {
  const rt = resourceType.toLowerCase();
  return /ec2|vm|virtual machine|droplet|compute|server|bare metal|lightsail|instance|node/.test(rt);
}

function normalizeTool(tool: string): string {
  return (tool || 'AWS').trim();
}

export async function estimateMonthlyCost(input: PricingEstimateInput): Promise<PricingEstimateResult> {
  const tool = normalizeTool(input.tool);
  const toolKey = tool.toLowerCase();
  const resourceType = input.resourceType || 'EC2';
  const rtUpper = resourceType.toUpperCase();

  const usageBased = isUsageOrSaaSResource(resourceType);
  const isDb = isDatabaseResource(resourceType);
  const isStorage = isStorageResource(resourceType);
  const isCompute = isComputeResource(resourceType) || (!usageBased && !isStorage && !isDb);

  const isSaasLike = isSaasLikeResource(resourceType);

  if (isSaasLike) {
    const geminiSaas = await estimateWithGemini(input);
    if (geminiSaas) return geminiSaas;
    const seats = parseSeatCount(`${input.instanceType || ''} ${input.instanceName || ''}`);
    if (seats) {
      return {
        monthlyCostUsd: 0,
        source: 'heuristic',
        note: `${seats} seats detected — enter monthly cost from your uploaded invoice or contract.`,
      };
    }
    return {
      monthlyCostUsd: 0,
      source: 'heuristic',
      note: 'Subscription pricing varies by plan — enter cost from your invoice or use Auto lookup with GEMINI_API_KEY.',
    };
  }

  // Storage-first (S3, Blob, EBS volume without instance)
  if (isStorage) {
    const storage = estimateFromStorage(input);
    if (storage) return storage;
  }

  // Provider-specific compute / DB catalogs
  if (toolKey.includes('aws')) {
    if (isCompute || isDb || rtUpper.includes('EC2') || rtUpper.includes('RDS') || rtUpper.includes('EKS') || rtUpper.includes('ECS')) {
      const catalog = estimateFromAwsCatalog(input);
      if (catalog) return catalog;
    }
  }

  if (toolKey.includes('azure')) {
    if (isCompute || isDb) {
      const catalog = estimateFromHourlyCatalog(AZURE_VM_HOURLY_USD, input, 'Azure');
      if (catalog) return catalog;
    }
    if (isStorage) {
      const storage = estimateFromStorage(input);
      if (storage) return storage;
    }
  }

  if (toolKey.includes('gcp')) {
    if (isCompute || isDb) {
      const catalog = estimateFromHourlyCatalog(GCP_MACHINE_HOURLY_USD, input, 'GCP');
      if (catalog) return catalog;
    }
    if (isStorage) {
      const storage = estimateFromStorage(input);
      if (storage) return storage;
    }
  }

  if (toolKey.includes('e2e')) {
    const e2e = estimateFromE2ECatalog(input);
    if (e2e) return e2e;
    const awsFallback = estimateFromAwsCatalog(input);
    if (awsFallback) return awsFallback;
  }

  if (toolKey.includes('digitalocean')) {
    const droplet = estimateFromDigitalOcean(input);
    if (droplet) return droplet;
  }

  if (toolKey.includes('oracle')) {
    const catalog = estimateFromHourlyCatalog(
      { 'vm.standard.e2.1': 0.03, 'vm.standard.e2.2': 0.06, 'vm.standard.e4.2': 0.12 },
      input,
      'Oracle Cloud'
    );
    if (catalog) return catalog;
  }

  // Any tool: try AWS catalog for known instance types (db.t3.medium works cross-cloud as rough proxy)
  if (input.instanceType?.trim()) {
    const genericAws = estimateFromAwsCatalog(input);
    if (genericAws) return genericAws;
  }

  const gemini = await estimateWithGemini(input);
  if (gemini) return gemini;

  if (usageBased && !input.instanceType?.trim() && !(Number(input.storage) > 0)) {
    return {
      monthlyCostUsd: 0,
      source: 'heuristic',
      note: 'Usage-based service — enter expected monthly spend from past bills, or describe plan/tier in the spec field.',
    };
  }

  if (isStorage && Number(input.storage) > 0) {
    const storage = estimateFromStorage(input);
    if (storage) return storage;
  }

  return estimateHeuristic(input);
}
