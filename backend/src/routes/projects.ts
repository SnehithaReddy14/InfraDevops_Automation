import { Router } from 'express';
import { 
  getProjects, 
  getProjectById,
  getProjectBillingView,
  getProjectBillingDiscrepancies,
  createProject, 
  updateProject, 
  deleteProject 
} from '../controllers/projectsController';
import { 
  getProjectResources, 
  createResource, 
  updateResource, 
  deleteResource 
} from '../controllers/resourcesController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all project management endpoints
router.use(authenticateToken);

// Project main operations
router.get('/', getProjects);
router.get('/:id', getProjectById);
router.get('/:id/billing-view', getProjectBillingView);
router.get('/:id/billing-discrepancies', getProjectBillingDiscrepancies);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Resource management sub-operations
router.get('/:id/resources', getProjectResources);
router.post('/:id/resources', createResource);
router.put('/resources/:id', updateResource);
router.delete('/resources/:id', deleteResource);

export default router;
