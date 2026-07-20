import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from './api';
import {
  buildDefaultBreadcrumbs,
  getNavigationState,
  projectInvoiceBreadcrumbs,
  type BreadcrumbItem,
} from './navigation';

/** Header breadcrumb trail for the current route (supports project → invoice context). */
export function useAppBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const navState = getNavigationState(location);

  const projectIdMatch = location.pathname.match(/^\/projects\/(\d+)/);
  const projectId = projectIdMatch ? Number(projectIdMatch[1]) : null;

  const invoiceIdMatch = location.pathname.match(/^\/invoices\/(\d+)/);
  const invoiceId = invoiceIdMatch ? Number(invoiceIdMatch[1]) : null;

  const { data: project } = useQuery({
    queryKey: ['breadcrumbProject', projectId],
    queryFn: () => api.get(`/projects/${projectId}`),
    enabled: projectId != null && !Number.isNaN(projectId),
    staleTime: 60_000,
  });

  const { data: invoiceData } = useQuery({
    queryKey: ['breadcrumbInvoice', invoiceId],
    queryFn: () => api.get(`/invoices/${invoiceId}`),
    enabled:
      invoiceId != null &&
      !Number.isNaN(invoiceId) &&
      !navState.breadcrumbs?.length,
    staleTime: 60_000,
  });

  const invoiceRecord = invoiceData?.invoice ?? invoiceData;
  const invoiceProjectId = invoiceRecord?.projectId as number | undefined;

  const { data: invoiceProject } = useQuery({
    queryKey: ['breadcrumbInvoiceProject', invoiceProjectId],
    queryFn: () => api.get(`/projects/${invoiceProjectId}`),
    enabled:
      invoiceProjectId != null &&
      !navState.breadcrumbs?.length &&
      invoiceId != null,
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (navState.breadcrumbs?.length) {
      return navState.breadcrumbs;
    }

    if (invoiceId != null && invoiceProject?.name && invoiceRecord) {
      return projectInvoiceBreadcrumbs(
        invoiceProject.name,
        invoiceProjectId!,
        invoiceRecord.invoiceNumber || 'Invoice',
        invoiceId
      );
    }

    const projectName =
      typeof project?.name === 'string' ? project.name : undefined;
    return buildDefaultBreadcrumbs(location.pathname, projectName);
  }, [
    location.pathname,
    navState.breadcrumbs,
    project?.name,
    invoiceId,
    invoiceProject?.name,
    invoiceProjectId,
    invoiceRecord,
  ]);
}
