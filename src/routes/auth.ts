import { Router } from 'express';
import * as authController from '../controllers/authController';
import { validateToken } from '../middlewares/auth';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', validateToken, authController.getProfile);

export const authRoutes = router;