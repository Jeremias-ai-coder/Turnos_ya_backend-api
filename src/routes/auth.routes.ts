import { Router } from 'express';
import { authController } from '../container';
import { authGuard } from '../middlewares/authGuard';

const router = Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/google', authController.googleAuth);
router.get('/me', authGuard, authController.getMe);
router.patch('/profile', authGuard, authController.updateProfile);
router.post('/request-password-change', authGuard, authController.requestPasswordChange);
router.post('/confirm-password-change', authGuard, authController.confirmPasswordChange);
router.patch('/change-password', authGuard, authController.changePassword);

export default router;