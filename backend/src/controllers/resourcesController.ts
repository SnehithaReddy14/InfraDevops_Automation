import { Response } from 'express';
import { prisma } from '../utils/db';
import { AuthenticatedRequest } from '../middleware/auth';

const RESOURCE_FIELDS = [
  'instanceName',
  'resourceType',
  'instanceType',
  'vcpus',
  'memory',
  'storage',
  'availabilityZone',
  'privateIp',
  'publicIp',
  'os',
  'monitoring',
  'monthlyCost',
  'billingSeats',
  'billingUnit',
  'status',
  'tags',
  'environment',
  'region',
  'tool',
] as const;

function pickResourceData(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of RESOURCE_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (data.tags && typeof data.tags !== 'string') {
    data.tags = JSON.stringify(data.tags);
  }
  return data;
}

// GET /projects/:id/resources - Get resources for a project
export const getProjectResources = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { id } = req.params;

  try {
    const resources = await prisma.cloudResource.findMany({
      where: { projectId: Number(id) },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(resources);
  } catch (error: any) {
    console.error('[Prisma Error] getProjectResources failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch project resources' });
  }
};

// POST /projects/:id/resources - Create resource under project
export const createResource = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;

  if (!body.instanceName || !body.resourceType) {
    return res.status(400).json({ error: 'Instance name and resource type are required.' });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: Number(id) }
    });

    if (!project) {
      return res.status(404).json({ error: 'Parent project not found' });
    }

    const picked = pickResourceData(body);
    const newResource = await prisma.cloudResource.create({
      data: {
        projectId: Number(id),
        instanceName: String(picked.instanceName),
        resourceType: String(picked.resourceType),
        instanceType: String(picked.instanceType || ''),
        vcpus: Number(picked.vcpus) || 1,
        memory: parseFloat(String(picked.memory)) || 0.0,
        storage: parseFloat(String(picked.storage)) || 0.0,
        availabilityZone: String(picked.availabilityZone || ''),
        privateIp: String(picked.privateIp || ''),
        publicIp: String(picked.publicIp || ''),
        os: String(picked.os || ''),
        monitoring: Boolean(picked.monitoring),
        monthlyCost: parseFloat(String(picked.monthlyCost)) || 0.0,
        billingSeats:
          picked.billingSeats !== undefined && picked.billingSeats !== null && picked.billingSeats !== ''
            ? parseInt(String(picked.billingSeats), 10) || null
            : null,
        billingUnit: picked.billingUnit ? String(picked.billingUnit) : null,
        status: String(picked.status || 'RUNNING'),
        tags: picked.tags ? String(picked.tags) : '{}',
        environment: String(picked.environment || 'Production'),
        region: String(picked.region || 'us-east-1'),
        tool: String(picked.tool || 'AWS'),
      }
    });

    return res.status(201).json(newResource);
  } catch (error: any) {
    console.error('[Prisma Error] createResource failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to add resource' });
  }
};

// PUT /resources/:id - Update specific resource
export const updateResource = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  const updateData = pickResourceData(req.body as Record<string, unknown>);

  if (!Object.keys(updateData).length) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  try {
    const existingResource = await prisma.cloudResource.findUnique({
      where: { id: Number(id) }
    });

    if (!existingResource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (updateData.billingSeats !== undefined) {
      updateData.billingSeats =
        updateData.billingSeats === '' || updateData.billingSeats === null
          ? null
          : parseInt(String(updateData.billingSeats), 10) || null;
    }

    const updatedResource = await prisma.cloudResource.update({
      where: { id: Number(id) },
      data: updateData
    });

    return res.status(200).json(updatedResource);
  } catch (error: any) {
    console.error('[Prisma Error] updateResource failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to update resource' });
  }
};

// DELETE /resources/:id - Delete a resource
export const deleteResource = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { id } = req.params;

  try {
    const resource = await prisma.cloudResource.findUnique({
      where: { id: Number(id) }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    await prisma.cloudResource.delete({
      where: { id: Number(id) }
    });

    return res.status(200).json({ message: 'Resource deleted successfully.' });
  } catch (error: any) {
    console.error('[Prisma Error] deleteResource failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete resource' });
  }
};
