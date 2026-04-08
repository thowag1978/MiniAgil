import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middlewares/authMiddleware';

export const authRoutes = Router();
const authController = new AuthController();

authRoutes.post('/register', authController.register);
authRoutes.post('/login', authController.login);
authRoutes.get('/me', authenticate, authController.me);
authRoutes.post('/forgot-password', authController.forgotPassword);
authRoutes.post('/reset-password', authController.resetPassword);
