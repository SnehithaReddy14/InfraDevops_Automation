export const TOOLS_LIST = [
  'AWS',
  'Microsoft Azure',
  'GCP',
  'E2E Cloud',
  'Jira',
  'GitHub Copilot',
  'Oracle Cloud',
  'DigitalOcean',
  'Custom / Other',
] as const;

export type ToolName = (typeof TOOLS_LIST)[number];

export const ENVIRONMENTS = [
  'Production',
  'Staging',
  'QA',
  'Development',
] as const;

export const REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-central-1',
  'ap-south-1',
  'global',
] as const;

/** Auto-generate an internal slug from the project display name (used for APIs, not shown in UI). */
export function slugifyProjectName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
