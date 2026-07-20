import { Router } from 'express';
import { register, login, refresh, me, updateProfile } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticateToken, me);
router.put('/profile', authenticateToken, updateProfile);

export default router;
