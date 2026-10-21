import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { IUserRepository, CreateUserDTO, UpdateUserDTO } from '../interfaces/user.interface';
import { AppError } from '../middlewares/errorHandler';
import { sendEmail } from './email.service';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret';

export class AuthService {
  constructor(private userRepo: IUserRepository) {}

  async register(data: { name: string; email: string; password: string }) {
    const existingUser = await this.userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('El email ya está en uso', 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.userRepo.create({
      name: data.name,
      email: data.email,
      password: hashedPassword
    });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    return {
      token,
      user: this.sanitizeUser(user)
    };
  }

  async login(data: { email: string; password: string }) {
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      throw new AppError('Credenciales incorrectas', 401);
    }

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) {
      throw new AppError('Credenciales incorrectas', 401);
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    return {
      token,
      user: this.sanitizeUser(user)
    };
  }

  async getMe(userId: number) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404);
    }

    return this.sanitizeUser(user);
  }

  async updateProfile(userId: number, data: UpdateUserDTO) {
    const updated = await this.userRepo.update(userId, data);
    return this.sanitizeUser(updated);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) {
      throw new AppError('Debe enviar la contraseña actual y la nueva contraseña', 400);
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new AppError('La nueva contraseña debe tener al menos 6 caracteres', 400);
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404);
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new AppError('La contraseña actual es incorrecta', 401);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(userId, { password: hashedPassword });

    return { message: 'Contraseña actualizada correctamente' };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // Por seguridad no revelamos si el email existe o no
      return {
        message: 'Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña.',
        sent: false,
      };
    }

    // Token firmado con JWT_SECRET + user.password (se invalida automáticamente si la contraseña cambia)
    const secret = JWT_SECRET + user.password;
    const token = jwt.sign(
      { id: user.id, email: user.email, type: 'PASSWORD_RESET' },
      secret,
      { expiresIn: '1h' }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://turnos-ya-frontend-web-delta.vercel.app';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Recuperación de contraseña - Turnos Ya',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #009ee3; margin: 0; font-size: 24px;">Turnos Ya</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Recuperación de cuenta</p>
          </div>
          <p style="font-size: 15px; color: #1e293b;">Hola <strong>${user.name}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta en Turnos Ya. 
            Haz clic en el botón a continuación para crear tu nueva contraseña (el enlace es válido por 1 hora):
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background-color: #009ee3; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
              Restablecer mi contraseña
            </a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
            Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br/>
            <a href="${resetUrl}" style="color: #009ee3; word-break: break-all;">${resetUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            Si no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña no cambiará.
          </p>
        </div>
      `,
    });

    return {
      message: 'Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña.',
      sent: emailResult.sent,
      // En modo híbrido / desarrollo / preview, devolvemos el resetUrl para pruebas inmediatas
      resetUrl,
      resetToken: token,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword || newPassword.length < 6) {
      throw new AppError('Token inválido o la contraseña debe tener al menos 6 caracteres', 400);
    }

    const decoded = jwt.decode(token) as { id: number; email: string; type: string } | null;
    if (!decoded || decoded.type !== 'PASSWORD_RESET' || !decoded.id) {
      throw new AppError('El token de recuperación es inválido o está mal formado', 400);
    }

    const user = await this.userRepo.findById(decoded.id);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404);
    }

    try {
      jwt.verify(token, JWT_SECRET + user.password);
    } catch {
      throw new AppError('El enlace de recuperación ha expirado o ya fue utilizado anteriormente.', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(user.id, { password: hashedPassword });

    return { message: 'Contraseña actualizada correctamente. Ya podés iniciar sesión con tus nuevas credenciales.' };
  }

  async loginWithGoogle(data: { credential?: string; email?: string; name?: string; googleId?: string }) {
    let email = data.email?.toLowerCase().trim();
    let name = data.name?.trim();

    // Si viene la credencial JWT de Google Identity Services, validarla con la API de Google
    if (data.credential) {
      try {
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${data.credential}`);
        if (!googleRes.ok) {
          throw new Error('Google token invalid');
        }
        const payload: any = await googleRes.json();
        email = payload.email?.toLowerCase().trim();
        name = payload.name || payload.given_name || email?.split('@')[0];
      } catch (err) {
        // Si no se pudo validar la credencial externa y no hay fallback de email, rechazar
        if (!email) {
          throw new AppError('Credencial de Google inválida o expirada', 401);
        }
      }
    }

    if (!email) {
      throw new AppError('No se pudo obtener el correo electrónico desde Google', 400);
    }

    let user = await this.userRepo.findByEmail(email);

    if (!user) {
      // Registrar nuevo usuario desde Google con rol cliente
      const randomPassword = await bcrypt.hash(Math.random().toString(36).slice(-10) + Date.now().toString(), 10);
      user = await this.userRepo.create({
        name: name || email.split('@')[0],
        email,
        password: randomPassword,
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      emailNotifications: user.emailNotifications,
      whatsappNotifications: user.whatsappNotifications,
      createdAt: user.createdAt || null,
      deletedAt: user.deletedAt || null
    };
  }
}

