import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { buildBillingView } from '../services/billingViewService';
import { buildDiscrepancyReport } from '../services/discrepancyService';
import { ensureFreshExchangeRate } from '../services/exchangeRateService';
import { invoiceIdsForEnvironment } from '../utils/invoiceEnvironment';

async function projectInvoiceWhere(projectId: number, environment: unknown) {
  const env = typeof environment === 'string' ? environment.trim() : '';
  if (!env) return { projectId };
  const ids = await invoiceIdsForEnvironment(env, projectId);
  return { projectId, id: { in: ids.length ? ids : [-1] } };
}

// GET /projects - Get list of projects
export const getProjects = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { search, status } = req.query;

  try {
    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: String(search) } },
        { code: { contains: String(search) } },
        { owner: { contains: String(search) } },
      ];
    }

    if (status) {
      whereClause.status = String(status);
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { resources: true }
        },
        resources: {
          select: { monthlyCost: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate dynamic aggregates (resource count, total monthly cost) for table presentation
    const formattedProjects = projects.map(p => {
      const resourceCount = p._count.resources;
      const monthlyCost = p.resources.reduce((sum, r) => sum + r.monthlyCost, 0);
      return {
        ...p,
        resourceCount,
        monthlyCost
      };
    });

    return res.status(200).json(formattedProjects);
  } catch (error: any) {
    console.error('[Prisma Error] getProjects failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch projects' });
  }
};

// GET /projects/:id - Get project details
export const getProjectById = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { id } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: Number(id) },
      include: {
        resources: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const monthlyCost = project.resources.reduce((sum, r) => sum + r.monthlyCost, 0);

    return res.status(200).json({
      ...project,
      monthlyCost,
      resourceCount: project.resources.length
    });
  } catch (error: any) {
    console.error('[Prisma Error] getProjectById failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch project details' });
  }
};

// GET /projects/:id/billing-view — dynamic spreadsheet-style billing from uploaded invoices
export const getProjectBillingView = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const projectId = Number(req.params.id);
  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const invoices = await prisma.invoice.findMany({
      where: await projectInvoiceWhere(projectId, req.query.environment),
      include: { items: true },
      orderBy: { invoiceDate: 'asc' },
    });

    await ensureFreshExchangeRate();

    const envLabel = typeof req.query.environment === 'string' ? req.query.environment.trim() : '';
    const view = buildBillingView(
      project.name,
      project.billingProvider,
      invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        billingMonth: inv.billingMonth,
        billingPeriod: inv.billingPeriod,
        grandTotal: inv.grandTotal,
        currency: inv.currency,
        metadata: inv.metadata,
        extractedJson: inv.extractedJson,
        items: inv.items.map((item) => ({ description: item.description, amount: item.amount })),
      }))
    );

    if (envLabel) {
      view.title = `${view.title} — ${envLabel}`;
      view.subtitle = view.subtitle
        ? `${view.subtitle} · Filtered to ${envLabel} invoices`
        : `${envLabel} environment billing`;
    }

    return res.status(200).json(view);
  } catch (error: any) {
    console.error('[Prisma Error] getProjectBillingView failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to build billing view' });
  }
};

// GET /projects/:id/billing-discrepancies — invoice vs infrastructure scope
export const getProjectBillingDiscrepancies = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const projectId = Number(req.params.id);
  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { resources: true },
    });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const envFilter = typeof req.query.environment === 'string' ? req.query.environment.trim() : '';

    const invoices = await prisma.invoice.findMany({
      where: await projectInvoiceWhere(projectId, req.query.environment),
      include: { items: true },
    });

    const scopedResources = project.resources
      .filter((r) => !envFilter || (r.environment || 'Production') === envFilter)
      .map((r) => ({
        id: r.id,
        instanceName: r.instanceName,
        resourceType: r.resourceType,
        tool: r.tool,
        monthlyCost: r.monthlyCost,
        environment: r.environment || 'Production',
      }));

    const report = buildDiscrepancyReport(
      projectId,
      scopedResources,
      invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        grandTotal: inv.grandTotal,
        metadata: inv.metadata,
        extractedJson: inv.extractedJson,
        items: inv.items.map((item) => ({ description: item.description, amount: item.amount })),
      }))
    );

    return res.status(200).json(report);
  } catch (error: any) {
    console.error('[Prisma Error] getProjectBillingDiscrepancies failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to build discrepancy report' });
  }
};

// POST /projects - Create a new project with resources
export const createProject = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const {
    name,
    code,
    description,
    owner,
    businessUnit,
    status,
    costCenter,
    tags,
    billingProvider,
    awsAccount,
    resources
  } = req.body;

  if (!name || !owner) {
    return res.status(400).json({ error: 'Project name and owner are required.' });
  }

  const projectCode = code || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  try {
    const newProject = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          code: projectCode,
          description: description || '',
          owner,
          businessUnit: businessUnit || '',
          status: status || 'ACTIVE',
          costCenter: costCenter || '',
          tags: tags ? JSON.stringify(tags) : '{}',
          billingProvider: billingProvider || 'AWS',
          awsAccount: awsAccount || '',
        }
      });

      if (resources && Array.isArray(resources) && resources.length > 0) {
        const resourcesData = resources.map((r: any) => ({
          projectId: project.id,
          instanceName: r.instanceName || 'resource',
          resourceType: r.resourceType || 'EC2',
          instanceType: r.instanceType || 't3.micro',
          vcpus: Number(r.vcpus) || 1,
          memory: parseFloat(r.memory) || 1.0,
          storage: parseFloat(r.storage) || 30.0,
          availabilityZone: r.availabilityZone || '',
          privateIp: r.privateIp || '',
          publicIp: r.publicIp || '',
          os: r.os || 'Linux',
          monitoring: Boolean(r.monitoring),
          monthlyCost: parseFloat(r.monthlyCost) || 0.0,
          status: r.status || 'RUNNING',
          tags: r.tags ? JSON.stringify(r.tags) : '{}',
          environment: r.environment || 'Production',
          region: r.region || 'us-east-1',
          tool: r.tool || billingProvider || 'AWS',
        }));

        await tx.cloudResource.createMany({
          data: resourcesData
        });
      }

      return project;
    });

    // Return project with resources
    const projectWithResources = await prisma.project.findUnique({
      where: { id: newProject.id },
      include: { resources: true }
    });

    return res.status(201).json(projectWithResources);
  } catch (error: any) {
    console.error('[Prisma Error] createProject failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to create project' });
  }
};

// PUT /projects/:id - Update an existing project
export const updateProject = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const existingProject = await prisma.project.findUnique({
      where: { id: Number(id) }
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Format sub-records to JSON strings if they are sent as objects/arrays
    const fieldsToFormat = ['tags'];
    fieldsToFormat.forEach(field => {
      if (updateData[field] && typeof updateData[field] !== 'string') {
        updateData[field] = JSON.stringify(updateData[field]);
      }
    });

    const updatedProject = await prisma.project.update({
      where: { id: Number(id) },
      data: updateData
    });

    return res.status(200).json(updatedProject);
  } catch (error: any) {
    console.error('[Prisma Error] updateProject failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to update project' });
  }
};

// DELETE /projects/:id - Delete a project
export const deleteProject = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { id } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: Number(id) },
      include: { resources: true }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.project.delete({
      where: { id: Number(id) }
    });

    return res.status(200).json({ message: 'Project and all associated resources deleted successfully.' });
  } catch (error: any) {
    console.error('[Prisma Error] deleteProject failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete project' });
  }
};
