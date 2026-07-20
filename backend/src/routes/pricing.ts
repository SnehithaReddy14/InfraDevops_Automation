import { Router } from 'express';
import { getPricingEstimate } from '../controllers/pricingController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/estimate', getPricingEstimate);

export default router;
