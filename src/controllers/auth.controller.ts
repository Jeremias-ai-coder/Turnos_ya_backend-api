import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AppError } from '../middlewares/errorHandler';
import { registerSchema, loginSchema } from '../validators/auth.validator';

export class AuthController {
  constructor(private authService: AuthService) {}

  register = async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
      throw new AppError('Datos inválidos', 400, details);
    }

    const result = await this.authService.register(parsed.data);
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
      throw new AppError('Datos inválidos', 400, details);
    }

    const result = await this.authService.login(parsed.data);
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
    const { currentPassword, newPassword } = req.body;

    const result = await this.authService.changePassword(userId, currentPassword, newPassword);
    res.json(result);
  };
}
