import { Request, Response } from 'express';
import { estimateMonthlyCost } from '../services/pricingService';

export const getPricingEstimate = async (req: Request, res: Response): Promise<any> => {
  const { tool, resourceType, instanceType, instanceName, region, vcpus, memory, storage } = req.query;

  if (!resourceType && !instanceType) {
    return res.status(400).json({ error: 'resourceType or instanceType is required' });
  }

  try {
    const result = await estimateMonthlyCost({
      tool: String(tool || 'AWS'),
      resourceType: String(resourceType || 'EC2'),
      instanceType: instanceType ? String(instanceType) : undefined,
      instanceName: instanceName ? String(instanceName) : undefined,
      region: region ? String(region) : 'us-east-1',
      vcpus: vcpus ? parseInt(String(vcpus), 10) : undefined,
      memory: memory ? parseFloat(String(memory)) : undefined,
      storage: storage ? parseFloat(String(storage)) : undefined,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[Pricing] estimate failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to estimate pricing' });
  }
};
