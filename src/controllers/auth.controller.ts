import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AppError } from '../middlewares/errorHandler';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, googleAuthSchema } from '../validators/auth.validator';

const getClientMeta = (req: Request) => {
  const userAgent = req.headers['user-agent'] as string | undefined;
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) || req.socket.remoteAddress || req.ip || undefined;
  const deviceName = (req.headers['x-device-name'] as string) || undefined;
  return { userAgent, ipAddress, deviceName };
};

export class AuthController {
  constructor(private authService: AuthService) {}

  register = async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
      throw new AppError('Datos inválidos', 400, details);
    }

    const result = await this.authService.register(parsed.data, getClientMeta(req));
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
      throw new AppError('Datos inválidos', 400, details);
    }

    const result = await this.authService.login(parsed.data, getClientMeta(req));
    res.json(result);
  };

  getMe = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const user = await this.authService.getMe(userId);
    res.json(user);
  };

  updateProfile = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { name, phone, emailNotifications, whatsappNotifications } = req.body;

    const updated = await this.authService.updateProfile(userId, {
      name,
      phone,
      emailNotifications,
      whatsappNotifications,
    });

    res.json(updated);
  };

  changePassword = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword, confirmationToken, code } = req.body;

    const result = await this.authService.changePassword(userId, currentPassword, newPassword, code, confirmationToken);
    res.json(result);
  };

  requestPasswordChange = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword && !newPassword) {
      const result = await this.authService.requestPasswordChangeCode(userId);
      return res.json(result);
    }

    const result = await this.authService.requestPasswordChange(userId, currentPassword, newPassword);
    res.json(result);
  };

  requestPasswordChangeCode = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.authService.requestPasswordChangeCode(userId);
    res.json(result);
  };

  verifyPasswordChangeCode = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { confirmationToken, code } = req.body;

    const result = await this.authService.verifyPasswordChangeCode(userId, confirmationToken, code);
    res.json(result);
  };

  submitPasswordChange = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { changeAuthToken, currentPassword, newPassword, skipCurrentPassword } = req.body;

    const result = await this.authService.submitPasswordChange(userId, {
      changeAuthToken,
      currentPassword,
      newPassword,
      skipCurrentPassword,
    });
    res.json(result);
  };

  confirmPasswordChange = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { confirmationToken, code } = req.body;

    const result = await this.authService.confirmPasswordChange(userId, confirmationToken, code);
    res.json(result);
  };

  forgotPassword = async (req: Request, res: Response) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
      throw new AppError('Datos inválidos', 400, details);
    }

    const result = await this.authService.forgotPassword(parsed.data.email);
    res.json(result);
  };

  resetPassword = async (req: Request, res: Response) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
      throw new AppError('Datos inválidos', 400, details);
    }

    const result = await this.authService.resetPassword(parsed.data.token, parsed.data.newPassword);
    res.json(result);
  };

  googleAuth = async (req: Request, res: Response) => {
    const parsed = googleAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
      throw new AppError('Datos inválidos', 400, details);
    }

    const result = await this.authService.loginWithGoogle(parsed.data, getClientMeta(req));
    res.json(result);
  };

  sendVerificationEmail = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.authService.sendVerificationEmail(userId);
    res.json(result);
  };

  verifyEmail = async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const token = req.body?.token || (req.query?.token as string);
    const { code, verificationToken } = req.body || {};
    const result = await this.authService.verifyEmail({ token, code, verificationToken, userId });
    res.json(result);
  };

  setupTwoFactor = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.authService.setupTwoFactor(userId);
    res.json(result);
  };

  verifyAndEnableTwoFactor = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { code } = req.body;
    if (!code) {
      throw new AppError('El código de 6 dígitos es requerido', 400);
    }
    const result = await this.authService.verifyAndEnableTwoFactor(userId, code);
    res.json(result);
  };

  disableTwoFactor = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { password, code } = req.body;
    const result = await this.authService.disableTwoFactor(userId, password, code);
    res.json(result);
  };

  verifyTwoFactorLogin = async (req: Request, res: Response) => {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      throw new AppError('Token temporal y código requeridos', 400);
    }
    const result = await this.authService.verifyTwoFactorLogin(tempToken, code, getClientMeta(req));
    res.json(result);
  };

  getSessions = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const sessions = await this.authService.getActiveSessions(user.id, user.sessionId);
    res.json(sessions);
  };

  revokeSession = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { id } = req.params;
    const result = await this.authService.revokeSession(user.id, id);
    res.json(result);
  };

  revokeAllOtherSessions = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const result = await this.authService.revokeAllOtherSessions(user.id, user.sessionId);
    res.json(result);
  };
}

