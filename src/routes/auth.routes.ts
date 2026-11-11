import { Router } from 'express';
import { authController } from '../container';
import { authGuard } from '../middlewares/authGuard';
import { createRateLimiter } from '../middlewares/rateLimiter';

const router = Router();

const authRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'auth' });
const otpRateLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 12, keyPrefix: 'otp' });

router.post('/login', authRateLimit, authController.login);
router.post('/register', authRateLimit, authController.register);
router.post('/forgot-password', authRateLimit, authController.forgotPassword);
router.post('/reset-password', authRateLimit, authController.resetPassword);
router.post('/google', authRateLimit, authController.googleAuth);
router.get('/me', authGuard, authController.getMe);
router.patch('/profile', authGuard, authController.updateProfile);
router.delete('/account', authGuard, authController.deactivateAccount);
router.post('/request-password-change-code', authGuard, otpRateLimit, authController.requestPasswordChangeCode);
router.post('/verify-password-change-code', authGuard, otpRateLimit, authController.verifyPasswordChangeCode);
router.post('/verify-password-change-2fa', authGuard, otpRateLimit, authController.verifyPasswordChange2FA);
router.post('/submit-password-change', authGuard, otpRateLimit, authController.submitPasswordChange);
router.post('/send-verification-email', authGuard, otpRateLimit, authController.sendVerificationEmail);
router.post('/verify-email', otpRateLimit, authController.verifyEmail);
router.get('/verify-email', otpRateLimit, authController.verifyEmail);

// Métodos de 2FA (Google Authenticator)
router.get('/2fa/setup', authGuard, authController.setupTwoFactor);
router.post('/2fa/setup', authGuard, authController.setupTwoFactor);
router.post('/2fa/verify-and-enable', authGuard, otpRateLimit, authController.verifyAndEnableTwoFactor);
router.post('/2fa/disable', authGuard, otpRateLimit, authController.disableTwoFactor);
router.post('/2fa/login-verify', otpRateLimit, authController.verifyTwoFactorLogin);

// Métodos de Gestión de Dispositivos y Sesiones
router.get('/sessions', authGuard, authController.getSessions);
router.delete('/sessions/:id', authGuard, authController.revokeSession);
router.post('/sessions/revoke-all', authGuard, authController.revokeAllOtherSessions);

export default router;