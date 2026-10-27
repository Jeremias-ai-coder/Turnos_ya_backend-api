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
router.post('/request-password-change-code', authGuard, authController.requestPasswordChangeCode);
router.post('/verify-password-change-code', authGuard, authController.verifyPasswordChangeCode);
router.post('/submit-password-change', authGuard, authController.submitPasswordChange);
router.post('/confirm-password-change', authGuard, authController.confirmPasswordChange);
router.post('/send-verification-email', authGuard, authController.sendVerificationEmail);
router.post('/verify-email', authController.verifyEmail);
router.get('/verify-email', authController.verifyEmail);
router.patch('/change-password', authGuard, authController.changePassword);

// Métodos de 2FA (Google Authenticator)
router.get('/2fa/setup', authGuard, authController.setupTwoFactor);
router.post('/2fa/setup', authGuard, authController.setupTwoFactor);
router.post('/2fa/verify-and-enable', authGuard, authController.verifyAndEnableTwoFactor);
router.post('/2fa/disable', authGuard, authController.disableTwoFactor);
router.post('/2fa/login-verify', authController.verifyTwoFactorLogin);

export default router;