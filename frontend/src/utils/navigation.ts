import type { Location, NavigateFunction } from 'react-router-dom';

export type BreadcrumbItem = {
  label: string;
  path: string;
};

export type NavigationState = {
  from?: string;
  breadcrumbs?: BreadcrumbItem[];
};

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  invoices: 'Invoices',
  upload: 'Upload',
};

/** Default breadcrumbs from URL when no custom trail was passed in navigation state. */
export function buildDefaultBreadcrumbs(pathname: string, projectName?: string): BreadcrumbItem[] {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) {
    return [{ label: 'Dashboard', path: '/dashboard' }];
  }

  const crumbs: BreadcrumbItem[] = [{ label: 'Dashboard', path: '/dashboard' }];

  let acc = '';
  for (let i = 0; i < parts.length; i++) {
    acc += `/${parts[i]}`;
    const part = parts[i];

    if (part === 'dashboard') continue;

    if (parts[0] === 'projects' && i === 1 && /^\d+$/.test(part)) {
      crumbs.push({ label: projectName || 'Project', path: acc });
      continue;
    }

    if (parts[0] === 'invoices' && i === 1 && /^\d+$/.test(part)) {
      crumbs.push({ label: 'Invoices', path: '/invoices' });
      crumbs.push({ label: 'Invoice', path: acc });
      continue;
    }

    const label =
      ROUTE_LABELS[part] ||
      part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
    crumbs.push({ label, path: acc });
  }

  return crumbs;
}

export function getNavigationState(location: Location): NavigationState {
  return (location.state as NavigationState | null) ?? {};
}

/** Resolve where "back" should go: explicit `from` → history → project tab → default. */
export function goBack(
  navigate: NavigateFunction,
  location: Location,
  options?: {
    projectId?: number | null;
    defaultPath?: string;
  }
) {
  const from = getNavigationState(location).from;
  if (from) {
    navigate(from);
    return;
  }

  const historyIdx = window.history.state?.idx;
  if (typeof historyIdx === 'number' && historyIdx > 0) {
    navigate(-1);
    return;
  }

  if (options?.projectId) {
    navigate(`/projects/${options.projectId}?tab=invoices`);
    return;
  }

  navigate(options?.defaultPath ?? '/invoices');
}

export function navigateWithReturn(
  navigate: NavigateFunction,
  to: string,
  returnTo: string,
  options?: { breadcrumbs?: BreadcrumbItem[] }
) {
  navigate(to, {
    state: {
      from: returnTo,
      ...(options?.breadcrumbs?.length ? { breadcrumbs: options.breadcrumbs } : {}),
    },
  });
}

export function projectInvoiceBreadcrumbs(
  projectName: string,
  projectId: number | string,
  invoiceLabel: string,
  invoiceId: number | string
): BreadcrumbItem[] {
  return [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Projects', path: '/projects' },
    { label: projectName, path: `/projects/${projectId}` },
    { label: invoiceLabel, path: `/invoices/${invoiceId}` },
  ];
}
