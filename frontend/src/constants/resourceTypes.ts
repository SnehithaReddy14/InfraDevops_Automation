export type SaasBillingModel = 'seats' | 'usage' | 'storage';

export interface ResourceTypeOption {
  value: string;
  label: string;
  group?: string;
  /** SaaS: show Plan/tier when the product name alone is not enough (e.g. User License → Standard). */
  needsPlanTier?: boolean;
  /** SaaS: seat-based vs usage vs storage billing — controls seats/storage fields. */
  saasBilling?: SaasBillingModel;
}

const COMMON_OTHER: ResourceTypeOption[] = [
  { value: 'Other', label: 'Other / Custom service', group: 'Other' },
];

export const RESOURCE_TYPES_BY_TOOL: Record<string, ResourceTypeOption[]> = {
  AWS: [
    { value: 'EC2', label: 'EC2 — Virtual Server (Compute)', group: 'Compute' },
    { value: 'Lambda', label: 'Lambda — Serverless Functions', group: 'Compute' },
    { value: 'ECS', label: 'ECS — Container Service', group: 'Compute' },
    { value: 'EKS', label: 'EKS — Kubernetes', group: 'Compute' },
    { value: 'Batch', label: 'AWS Batch', group: 'Compute' },
    { value: 'Lightsail', label: 'Lightsail — Simple VPS', group: 'Compute' },
    { value: 'RDS', label: 'RDS — Relational Database', group: 'Database' },
    { value: 'DynamoDB', label: 'DynamoDB — NoSQL Database', group: 'Database' },
    { value: 'ElastiCache', label: 'ElastiCache — Redis / Memcached', group: 'Database' },
    { value: 'DocumentDB', label: 'DocumentDB — MongoDB-compatible', group: 'Database' },
    { value: 'Redshift', label: 'Redshift — Data Warehouse', group: 'Database' },
    { value: 'Aurora', label: 'Aurora — Managed SQL', group: 'Database' },
    { value: 'S3', label: 'S3 — Object Storage', group: 'Storage' },
    { value: 'EBS', label: 'EBS — Block Storage Volume', group: 'Storage' },
    { value: 'EFS', label: 'EFS — Shared File Storage', group: 'Storage' },
    { value: 'Glacier', label: 'Glacier / S3 Glacier — Archive', group: 'Storage' },
    { value: 'ALB', label: 'ALB — Application Load Balancer', group: 'Networking' },
    { value: 'NLB', label: 'NLB — Network Load Balancer', group: 'Networking' },
    { value: 'CloudFront', label: 'CloudFront — CDN', group: 'Networking' },
    { value: 'Route53', label: 'Route 53 — DNS', group: 'Networking' },
    { value: 'VPC', label: 'VPC — Virtual Private Cloud', group: 'Networking' },
    { value: 'NAT Gateway', label: 'NAT Gateway', group: 'Networking' },
    { value: 'VPN', label: 'Site-to-Site / Client VPN', group: 'Networking' },
    { value: 'Direct Connect', label: 'Direct Connect', group: 'Networking' },
    { value: 'API Gateway', label: 'API Gateway', group: 'Integration' },
    { value: 'SQS', label: 'SQS — Message Queue', group: 'Integration' },
    { value: 'SNS', label: 'SNS — Notifications', group: 'Integration' },
    { value: 'EventBridge', label: 'EventBridge — Event Bus', group: 'Integration' },
    { value: 'Step Functions', label: 'Step Functions', group: 'Integration' },
    { value: 'CloudWatch', label: 'CloudWatch — Monitoring & Logs', group: 'Management' },
    { value: 'KMS', label: 'KMS — Key Management', group: 'Security' },
    { value: 'Secrets Manager', label: 'Secrets Manager', group: 'Security' },
    { value: 'WAF', label: 'WAF — Web Application Firewall', group: 'Security' },
    { value: 'EMR', label: 'EMR — Big Data / Spark', group: 'Analytics' },
    { value: 'Athena', label: 'Athena — SQL on S3', group: 'Analytics' },
    { value: 'Glue', label: 'Glue — ETL', group: 'Analytics' },
    { value: 'OpenSearch', label: 'OpenSearch — Search & Logs', group: 'Analytics' },
    { value: 'SageMaker', label: 'SageMaker — ML Platform', group: 'AI/ML' },
    ...COMMON_OTHER,
  ],

  'Microsoft Azure': [
    { value: 'Virtual Machine', label: 'Virtual Machine (VM)', group: 'Compute' },
    { value: 'App Service', label: 'App Service — Web Apps', group: 'Compute' },
    { value: 'Functions', label: 'Azure Functions — Serverless', group: 'Compute' },
    { value: 'AKS', label: 'AKS — Kubernetes', group: 'Compute' },
    { value: 'Container Instances', label: 'Container Instances (ACI)', group: 'Compute' },
    { value: 'Batch', label: 'Azure Batch', group: 'Compute' },
    { value: 'SQL Database', label: 'Azure SQL Database', group: 'Database' },
    { value: 'Cosmos DB', label: 'Cosmos DB — NoSQL', group: 'Database' },
    { value: 'PostgreSQL', label: 'Azure Database for PostgreSQL', group: 'Database' },
    { value: 'MySQL', label: 'Azure Database for MySQL', group: 'Database' },
    { value: 'Redis Cache', label: 'Azure Cache for Redis', group: 'Database' },
    { value: 'Synapse', label: 'Synapse Analytics', group: 'Database' },
    { value: 'Blob Storage', label: 'Blob Storage', group: 'Storage' },
    { value: 'Files', label: 'Azure Files', group: 'Storage' },
    { value: 'Disk Storage', label: 'Managed Disks', group: 'Storage' },
    { value: 'Data Lake', label: 'Data Lake Storage', group: 'Storage' },
    { value: 'Load Balancer', label: 'Load Balancer', group: 'Networking' },
    { value: 'Application Gateway', label: 'Application Gateway', group: 'Networking' },
    { value: 'Front Door', label: 'Front Door — CDN / WAF', group: 'Networking' },
    { value: 'VPN Gateway', label: 'VPN Gateway', group: 'Networking' },
    { value: 'ExpressRoute', label: 'ExpressRoute', group: 'Networking' },
    { value: 'Virtual Network', label: 'Virtual Network (VNet)', group: 'Networking' },
    { value: 'DNS', label: 'Azure DNS', group: 'Networking' },
    { value: 'Service Bus', label: 'Service Bus — Messaging', group: 'Integration' },
    { value: 'Event Hubs', label: 'Event Hubs', group: 'Integration' },
    { value: 'Logic Apps', label: 'Logic Apps', group: 'Integration' },
    { value: 'API Management', label: 'API Management', group: 'Integration' },
    { value: 'Monitor', label: 'Azure Monitor & Log Analytics', group: 'Management' },
    { value: 'Key Vault', label: 'Key Vault', group: 'Security' },
    { value: 'Sentinel', label: 'Microsoft Sentinel — SIEM', group: 'Security' },
    { value: 'Databricks', label: 'Azure Databricks', group: 'Analytics' },
    { value: 'HDInsight', label: 'HDInsight — Hadoop / Spark', group: 'Analytics' },
    { value: 'Machine Learning', label: 'Azure Machine Learning', group: 'AI/ML' },
    ...COMMON_OTHER,
  ],

  GCP: [
    { value: 'Compute Engine', label: 'Compute Engine — VM', group: 'Compute' },
    { value: 'Cloud Run', label: 'Cloud Run — Containers', group: 'Compute' },
    { value: 'Cloud Functions', label: 'Cloud Functions — Serverless', group: 'Compute' },
    { value: 'GKE', label: 'GKE — Kubernetes', group: 'Compute' },
    { value: 'App Engine', label: 'App Engine', group: 'Compute' },
    { value: 'Cloud SQL', label: 'Cloud SQL', group: 'Database' },
    { value: 'Firestore', label: 'Firestore — NoSQL', group: 'Database' },
    { value: 'Bigtable', label: 'Bigtable — Wide-column DB', group: 'Database' },
    { value: 'Spanner', label: 'Cloud Spanner', group: 'Database' },
    { value: 'Memorystore', label: 'Memorystore — Redis', group: 'Database' },
    { value: 'Cloud Storage', label: 'Cloud Storage — Object', group: 'Storage' },
    { value: 'Persistent Disk', label: 'Persistent Disk — Block', group: 'Storage' },
    { value: 'Filestore', label: 'Filestore — NFS', group: 'Storage' },
    { value: 'Load Balancing', label: 'Cloud Load Balancing', group: 'Networking' },
    { value: 'Cloud CDN', label: 'Cloud CDN', group: 'Networking' },
    { value: 'Cloud DNS', label: 'Cloud DNS', group: 'Networking' },
    { value: 'VPC', label: 'VPC Network', group: 'Networking' },
    { value: 'Cloud NAT', label: 'Cloud NAT', group: 'Networking' },
    { value: 'Cloud VPN', label: 'Cloud VPN', group: 'Networking' },
    { value: 'Pub/Sub', label: 'Pub/Sub — Messaging', group: 'Integration' },
    { value: 'Cloud Scheduler', label: 'Cloud Scheduler', group: 'Integration' },
    { value: 'Apigee', label: 'Apigee — API Management', group: 'Integration' },
    { value: 'Cloud Monitoring', label: 'Cloud Monitoring & Logging', group: 'Management' },
    { value: 'Secret Manager', label: 'Secret Manager', group: 'Security' },
    { value: 'BigQuery', label: 'BigQuery — Data Warehouse', group: 'Analytics' },
    { value: 'Dataflow', label: 'Dataflow — Stream/Batch', group: 'Analytics' },
    { value: 'Dataproc', label: 'Dataproc — Spark / Hadoop', group: 'Analytics' },
    { value: 'Vertex AI', label: 'Vertex AI — ML Platform', group: 'AI/ML' },
    ...COMMON_OTHER,
  ],

  'E2E Cloud': [
    { value: 'Virtual Machine', label: 'Virtual Machine (Compute Node)', group: 'Compute' },
    { value: 'Kubernetes', label: 'Kubernetes Cluster', group: 'Compute' },
    { value: 'Container', label: 'Container Service', group: 'Compute' },
    { value: 'Bare Metal', label: 'Bare Metal Server', group: 'Compute' },
    { value: 'MySQL', label: 'MySQL Database', group: 'Database' },
    { value: 'PostgreSQL', label: 'PostgreSQL Database', group: 'Database' },
    { value: 'Redis', label: 'Redis Cache', group: 'Database' },
    { value: 'Block Storage', label: 'Block Storage Volume', group: 'Storage' },
    { value: 'Object Storage', label: 'Object Storage (S3-compatible)', group: 'Storage' },
    { value: 'Load Balancer', label: 'Load Balancer', group: 'Networking' },
    { value: 'VPC', label: 'Virtual Private Cloud', group: 'Networking' },
    { value: 'Firewall', label: 'Firewall / Security Group', group: 'Networking' },
    { value: 'Floating IP', label: 'Floating / Public IP', group: 'Networking' },
    { value: 'Backup', label: 'Backup & Snapshot', group: 'Management' },
    { value: 'Monitoring', label: 'Monitoring', group: 'Management' },
    { value: 'CDP', label: 'CDP — Continuous Data Protection', group: 'Storage' },
    ...COMMON_OTHER,
  ],

  Jira: [
    { value: 'Cloud Subscription', label: 'Jira Cloud — Site Subscription', group: 'SaaS', needsPlanTier: true, saasBilling: 'seats' },
    { value: 'User License', label: 'User License (per seat)', group: 'SaaS', needsPlanTier: true, saasBilling: 'seats' },
    { value: 'App/Plugin', label: 'Marketplace App / Plugin', group: 'SaaS', needsPlanTier: true, saasBilling: 'seats' },
    { value: 'Storage Add-on', label: 'Storage Add-on', group: 'SaaS', needsPlanTier: false, saasBilling: 'storage' },
    { value: 'Automation', label: 'Automation / Rules quota', group: 'SaaS', needsPlanTier: false, saasBilling: 'usage' },
    { value: 'Support Plan', label: 'Premium / Enterprise Support', group: 'SaaS', needsPlanTier: false, saasBilling: 'usage' },
    ...COMMON_OTHER,
  ],

  'GitHub Copilot': [
    { value: 'Copilot Business', label: 'Copilot Business — per user', group: 'SaaS', needsPlanTier: false, saasBilling: 'seats' },
    { value: 'Copilot Enterprise', label: 'Copilot Enterprise — per user', group: 'SaaS', needsPlanTier: false, saasBilling: 'seats' },
    { value: 'Copilot Individual', label: 'Copilot Individual', group: 'SaaS', needsPlanTier: false, saasBilling: 'seats' },
    { value: 'GitHub Actions', label: 'GitHub Actions — CI/CD minutes', group: 'SaaS', needsPlanTier: false, saasBilling: 'usage' },
    { value: 'GitHub Packages', label: 'GitHub Packages — storage', group: 'SaaS', needsPlanTier: false, saasBilling: 'storage' },
    { value: 'Codespaces', label: 'GitHub Codespaces', group: 'SaaS', needsPlanTier: false, saasBilling: 'usage' },
    ...COMMON_OTHER,
  ],

  'Oracle Cloud': [
    { value: 'Compute VM', label: 'Compute — Virtual Machine', group: 'Compute' },
    { value: 'Container Engine', label: 'OKE — Kubernetes', group: 'Compute' },
    { value: 'Functions', label: 'Oracle Functions', group: 'Compute' },
    { value: 'Autonomous DB', label: 'Autonomous Database', group: 'Database' },
    { value: 'MySQL', label: 'MySQL HeatWave', group: 'Database' },
    { value: 'NoSQL', label: 'NoSQL Database', group: 'Database' },
    { value: 'Object Storage', label: 'Object Storage', group: 'Storage' },
    { value: 'Block Volume', label: 'Block Volume', group: 'Storage' },
    { value: 'File Storage', label: 'File Storage', group: 'Storage' },
    { value: 'Load Balancer', label: 'Load Balancer', group: 'Networking' },
    { value: 'VCN', label: 'VCN — Virtual Cloud Network', group: 'Networking' },
    { value: 'DNS', label: 'OCI DNS', group: 'Networking' },
    ...COMMON_OTHER,
  ],

  DigitalOcean: [
    { value: 'Droplet', label: 'Droplet — VM', group: 'Compute' },
    { value: 'Kubernetes', label: 'DOKS — Kubernetes', group: 'Compute' },
    { value: 'App Platform', label: 'App Platform', group: 'Compute' },
    { value: 'Functions', label: 'Serverless Functions', group: 'Compute' },
    { value: 'Managed Database', label: 'Managed Database (PostgreSQL/MySQL/Redis)', group: 'Database' },
    { value: 'Spaces', label: 'Spaces — Object Storage', group: 'Storage' },
    { value: 'Volumes', label: 'Block Storage Volumes', group: 'Storage' },
    { value: 'Load Balancer', label: 'Load Balancer', group: 'Networking' },
    { value: 'VPC', label: 'VPC', group: 'Networking' },
    { value: 'Floating IP', label: 'Floating IP', group: 'Networking' },
    ...COMMON_OTHER,
  ],

  'Custom / Other': [
    { value: 'Virtual Machine', label: 'Virtual Machine / Server', group: 'Compute' },
    { value: 'Database', label: 'Database', group: 'Database' },
    { value: 'Object Storage', label: 'Object Storage', group: 'Storage' },
    { value: 'Block Storage', label: 'Block Storage', group: 'Storage' },
    { value: 'Load Balancer', label: 'Load Balancer', group: 'Networking' },
    { value: 'CDN', label: 'CDN', group: 'Networking' },
    { value: 'Kubernetes', label: 'Kubernetes Cluster', group: 'Compute' },
    { value: 'Serverless', label: 'Serverless / Functions', group: 'Compute' },
    { value: 'SaaS Subscription', label: 'SaaS Subscription', group: 'SaaS', needsPlanTier: true, saasBilling: 'seats' },
    { value: 'License', label: 'Software License', group: 'SaaS', needsPlanTier: true, saasBilling: 'seats' },
    ...COMMON_OTHER,
  ],
};

/** Fallback when tool name doesn't match exactly */
const GENERIC_RESOURCE_TYPES: ResourceTypeOption[] = [
  { value: 'Virtual Machine', label: 'Virtual Machine / Compute', group: 'Compute' },
  { value: 'Database', label: 'Database', group: 'Database' },
  { value: 'Object Storage', label: 'Object Storage', group: 'Storage' },
  { value: 'Block Storage', label: 'Block Storage', group: 'Storage' },
  { value: 'Load Balancer', label: 'Load Balancer', group: 'Networking' },
  { value: 'CDN', label: 'CDN / Edge', group: 'Networking' },
  { value: 'Kubernetes', label: 'Kubernetes', group: 'Compute' },
  { value: 'Serverless', label: 'Serverless Functions', group: 'Compute' },
  { value: 'Messaging', label: 'Queue / Messaging', group: 'Integration' },
  { value: 'Monitoring', label: 'Monitoring & Logs', group: 'Management' },
  { value: 'SaaS Subscription', label: 'SaaS Subscription', group: 'SaaS' },
  ...COMMON_OTHER,
];

export function getResourceTypesForTool(tool: string): ResourceTypeOption[] {
  return RESOURCE_TYPES_BY_TOOL[tool] ?? GENERIC_RESOURCE_TYPES;
}

export function getDefaultResourceTypeForTool(tool: string): string {
  return getResourceTypesForTool(tool)[0]?.value ?? 'Virtual Machine';
}

/** Sensible default instance/spec per provider for auto pricing lookup. */
export function getDefaultInstanceTypeForTool(tool: string, resourceType?: string): string {
  const rt = (resourceType || '').toLowerCase();
  const isDb = /rds|database|sql|postgres|mysql|redis|cache|mongo|aurora|cosmos|cloud sql/.test(rt);

  if (tool === 'AWS') {
    return isDb ? 'db.t3.micro' : 't3.micro';
  }
  if (tool === 'Microsoft Azure') {
    return isDb ? 'Standard_B2ms' : 'Standard_B2s';
  }
  if (tool === 'GCP') {
    return isDb ? 'db-f1-micro' : 'e2-medium';
  }
  if (tool === 'E2E Cloud') {
    return isDb ? 'MySQL-Small' : 'C3.8GB';
  }
  if (tool === 'DigitalOcean') {
    return isDb ? 'db-s-1vcpu-1gb' : 's-2vcpu-4gb';
  }
  if (tool === 'Oracle Cloud') {
    return 'VM.Standard.E2.1';
  }
  if (toolHasSaasResources(tool)) {
    return '';
  }
  return '';
}

/** Whether the form has enough data to request a pricing estimate. */
export function canLookupResourcePricing(
  profile: ResourceFormProfile,
  form: {
    instanceType: string;
    vcpus: string;
    memory: string;
    storage: string;
    billingSeats: string;
    tool: string;
    resourceType: string;
  }
): boolean {
  if (form.instanceType?.trim()) return true;
  if (profile.showStorage && parseFloat(form.storage) > 0) return true;
  if (profile.showVcpus && parseInt(form.vcpus, 10) > 0) return true;
  if (profile.showMemory && parseFloat(form.memory) > 0) return true;
  if (profile.id === 'usage' || profile.id === 'saas') return true;
  if (profile.showBillingSeats && parseInt(form.billingSeats, 10) > 0) return true;
  if (!profile.specRequiredForLookup) return true;
  const defaultSpec = getDefaultInstanceTypeForTool(form.tool, form.resourceType);
  return Boolean(defaultSpec);
}

export type ResourceFormProfileId =
  | 'compute'
  | 'container'
  | 'database'
  | 'storage'
  | 'serverless'
  | 'usage'
  | 'saas'
  | 'generic';

export interface ResourceFormProfile {
  id: ResourceFormProfileId;
  showInstanceSpec: boolean;
  showVcpus: boolean;
  showMemory: boolean;
  showStorage: boolean;
  showBillingSeats: boolean;
  showIp: boolean;
  /** Cloud region field (not applicable to pure SaaS subscriptions). */
  showRegion: boolean;
  instanceSpecLabel: string;
  instanceSpecPlaceholder: string;
  memoryLabel: string;
  storageLabel: string;
  pricingHint: string;
  specRequiredForLookup: boolean;
}

function findResourceOption(tool: string, resourceType: string): ResourceTypeOption | undefined {
  return getResourceTypesForTool(tool).find((t) => t.value === resourceType);
}

function resolveProfileId(group?: string, resourceType?: string): ResourceFormProfileId {
  const v = (resourceType || '').toLowerCase();

  if (
    v.includes('lambda') ||
    v.includes('function') ||
    v.includes('cloud run') ||
    v.includes('serverless') ||
    v.includes('app engine')
  ) {
    return 'serverless';
  }
  if (
    group === 'SaaS' ||
    v.includes('license') ||
    v.includes('subscription') ||
    v.includes('copilot')
  ) {
    return 'saas';
  }
  if (group === 'Storage' || v.includes('s3') || v.includes('blob') || v.includes('spaces')) {
    return 'storage';
  }
  if (group === 'Database') {
    return 'database';
  }
  if (
    group === 'Integration' ||
    group === 'Networking' ||
    group === 'Security' ||
    group === 'Management'
  ) {
    return 'usage';
  }
  if (group === 'Analytics' || group === 'AI/ML') {
    if (v.includes('athena') || v.includes('glue')) return 'usage';
    return 'database';
  }
  if (group === 'Compute') {
    if (
      v.includes('eks') ||
      v.includes('ecs') ||
      v.includes('gke') ||
      v.includes('kubernetes') ||
      v.includes('aks') ||
      v.includes('container')
    ) {
      return 'container';
    }
    return 'compute';
  }
  return 'generic';
}

const FORM_PROFILES: Record<ResourceFormProfileId, Omit<ResourceFormProfile, 'id'>> = {
  compute: {
    showInstanceSpec: true,
    showVcpus: true,
    showMemory: true,
    showStorage: true,
    showBillingSeats: false,
    showIp: true,
    showRegion: true,
    instanceSpecLabel: 'Instance type / size',
    instanceSpecPlaceholder: 'e.g. t3.medium',
    memoryLabel: 'RAM (GB)',
    storageLabel: 'Storage (GB)',
    pricingHint: 'Auto lookup uses provider list prices for instance type, vCPU/RAM, and storage.',
    specRequiredForLookup: true,
  },
  container: {
    showInstanceSpec: true,
    showVcpus: false,
    showMemory: false,
    showStorage: false,
    showBillingSeats: false,
    showIp: false,
    showRegion: true,
    instanceSpecLabel: 'Cluster / node pool size',
    instanceSpecPlaceholder: 'e.g. 3 nodes × m5.large',
    memoryLabel: 'RAM (GB)',
    storageLabel: 'Storage (GB)',
    pricingHint: 'Describe cluster size — pricing is estimated from spec text.',
    specRequiredForLookup: true,
  },
  database: {
    showInstanceSpec: true,
    showVcpus: false,
    showMemory: false,
    showStorage: true,
    showBillingSeats: false,
    showIp: false,
    showRegion: true,
    instanceSpecLabel: 'DB instance class',
    instanceSpecPlaceholder: 'e.g. db.t3.medium',
    memoryLabel: 'RAM (GB)',
    storageLabel: 'Allocated storage (GB)',
    pricingHint: 'Auto lookup uses DB instance class + storage.',
    specRequiredForLookup: true,
  },
  storage: {
    showInstanceSpec: true,
    showVcpus: false,
    showMemory: false,
    showStorage: true,
    showBillingSeats: false,
    showIp: false,
    showRegion: true,
    instanceSpecLabel: 'Storage class / tier',
    instanceSpecPlaceholder: 'e.g. S3 Standard, Glacier',
    memoryLabel: 'RAM (GB)',
    storageLabel: 'Capacity (GB)',
    pricingHint: 'Pricing based on storage tier and capacity.',
    specRequiredForLookup: false,
  },
  serverless: {
    showInstanceSpec: true,
    showVcpus: false,
    showMemory: true,
    showStorage: false,
    showBillingSeats: false,
    showIp: false,
    showRegion: true,
    instanceSpecLabel: 'Memory / tier',
    instanceSpecPlaceholder: 'e.g. 512 MB, 1 GB',
    memoryLabel: 'Memory (GB)',
    storageLabel: 'Storage (GB)',
    pricingHint: 'Serverless — cost depends on invocations and memory.',
    specRequiredForLookup: false,
  },
  usage: {
    showInstanceSpec: false,
    showVcpus: false,
    showMemory: false,
    showStorage: false,
    showBillingSeats: false,
    showIp: false,
    showRegion: true,
    instanceSpecLabel: 'Plan / tier',
    instanceSpecPlaceholder: 'Optional',
    memoryLabel: 'RAM (GB)',
    storageLabel: 'Storage (GB)',
    pricingHint: 'Usage-based service (SNS, SQS, LB, etc.) — no servers. Enter expected monthly spend or use Auto lookup.',
    specRequiredForLookup: false,
  },
  saas: {
    showInstanceSpec: false,
    showVcpus: false,
    showMemory: false,
    showStorage: false,
    showBillingSeats: true,
    showIp: false,
    showRegion: false,
    instanceSpecLabel: 'Plan / tier',
    instanceSpecPlaceholder: 'e.g. Standard, Premium',
    memoryLabel: 'RAM (GB)',
    storageLabel: 'Storage (GB)',
    pricingHint: 'Enter billed users/agents and monthly cost from your subscription invoice.',
    specRequiredForLookup: false,
  },
  generic: {
    showInstanceSpec: true,
    showVcpus: false,
    showMemory: false,
    showStorage: false,
    showBillingSeats: false,
    showIp: false,
    showRegion: true,
    instanceSpecLabel: 'Spec / plan (optional)',
    instanceSpecPlaceholder: 'Describe the resource',
    memoryLabel: 'RAM (GB)',
    storageLabel: 'Storage (GB)',
    pricingHint: 'Enter monthly cost manually or use Auto lookup.',
    specRequiredForLookup: false,
  },
};

/** Fallback generic SaaS categories (saved rows / Custom → Other) where plan/tier is not in the type name. */
const GENERIC_SAAS_RESOURCE_TYPES = new Set([
  'Cloud Subscription',
  'User License',
  'App/Plugin',
  'SaaS Subscription',
  'License',
  'Other',
]);

function getSaasBillingModel(tool: string, resourceType: string): SaasBillingModel {
  const option = findResourceOption(tool, resourceType);
  if (option?.saasBilling) return option.saasBilling;
  if (resourceType === 'Storage Add-on' || /packages|storage add-on/i.test(resourceType)) {
    return 'storage';
  }
  if (/actions|automation|codespaces|support plan/i.test(resourceType)) {
    return 'usage';
  }
  return 'seats';
}

export function saasResourceTypeNeedsPlanField(tool: string, resourceType: string): boolean {
  const option = findResourceOption(tool, resourceType);
  if (option?.needsPlanTier !== undefined) return option.needsPlanTier;
  return GENERIC_SAAS_RESOURCE_TYPES.has(resourceType);
}

const SAAS_PRICING_HINTS: Record<SaasBillingModel, string> = {
  seats: 'Enter billed users/agents and monthly cost from your subscription invoice.',
  usage: 'Usage-based billing — enter expected monthly spend from your invoice.',
  storage: 'Enter storage capacity (GB) and monthly cost from your invoice.',
};

export function getResourceFormProfile(tool: string, resourceType: string): ResourceFormProfile {
  const option = findResourceOption(tool, resourceType);
  const id = resolveProfileId(option?.group, resourceType);
  const base = { id, ...FORM_PROFILES[id] };
  if (id === 'saas') {
    const billing = getSaasBillingModel(tool, resourceType);
    return {
      ...base,
      showInstanceSpec: saasResourceTypeNeedsPlanField(tool, resourceType),
      showBillingSeats: billing === 'seats',
      showStorage: billing === 'storage',
      pricingHint: SAAS_PRICING_HINTS[billing],
    };
  }
  return base;
}

/** Any resource type under SaaS group for this tool (subscription billing). */
export function toolHasSaasResources(tool: string): boolean {
  return getResourceTypesForTool(tool).some((o) => o.group === 'SaaS');
}

export function isSaasResource(tool: string, resourceType: string): boolean {
  return getResourceFormProfile(tool, resourceType).showBillingSeats;
}

/** Clear fields that do not apply to the selected service type. */
export function applyProfileToFormFields<T extends {
  instanceType: string;
  vcpus: string;
  memory: string;
  storage: string;
  publicIp: string;
  region: string;
  billingSeats?: string;
}>(form: T, tool: string, resourceType: string): T {
  const profile = getResourceFormProfile(tool, resourceType);
  return {
    ...form,
    instanceType: profile.showInstanceSpec ? form.instanceType : '',
    vcpus: profile.showVcpus ? form.vcpus : '',
    memory: profile.showMemory ? form.memory : '',
    storage: profile.showStorage ? form.storage : '',
    publicIp: profile.showIp ? form.publicIp : '',
    region: profile.showRegion ? form.region : 'global',
    ...(form.billingSeats !== undefined && {
      billingSeats: profile.showBillingSeats ? form.billingSeats : '',
    }),
  };
}

/** @deprecated use getResourceFormProfile().instanceSpecLabel */
export function getInstanceSpecLabel(resourceType: string): string {
  return getResourceFormProfile('AWS', resourceType).instanceSpecLabel;
}
