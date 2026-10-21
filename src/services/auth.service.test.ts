import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { IUserRepository } from '../interfaces/user.interface';
import { AppError } from '../middlewares/errorHandler';

describe('AuthService (Unit Tests)', () => {
  let authService: AuthService;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    authService = new AuthService(mockUserRepo);
  });

  describe('register', () => {
    it('debe registrar un nuevo usuario exitosamente con password hasheada y retornar token', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      const fakeCreatedUser = {
        id: 1,
        name: 'Nuevo Usuario',
        email: 'nuevo@example.com',
        password: 'hashed_password',
        role: 'client',
        phone: null,
        emailNotifications: true,
        whatsappNotifications: true,
        createdAt: new Date(),
        deletedAt: null,
      };

      mockUserRepo.create.mockResolvedValue(fakeCreatedUser as any);

      const result = await authService.register({
        name: 'Nuevo Usuario',
        email: 'nuevo@example.com',
        password: 'password123',
      });

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('nuevo@example.com');
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nuevo Usuario',
          email: 'nuevo@example.com',
        })
      );
      expect(result).toHaveProperty('token');
      expect(result.user).toEqual(
        expect.objectContaining({
          id: 1,
          name: 'Nuevo Usuario',
          email: 'nuevo@example.com',
        })
      );
      // Garantizar que la contraseña hasheada NO se expone en la respuesta
      expect(result.user).not.toHaveProperty('password');
    });

    it('debe lanzar AppError 400 si el email ya se encuentra registrado', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({
        id: 1,
        email: 'existente@example.com',
      } as any);

      await expect(
        authService.register({
          name: 'Usuario Duplicado',
          email: 'existente@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(AppError);

      await expect(
        authService.register({
          name: 'Usuario Duplicado',
          email: 'existente@example.com',
          password: 'password123',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'El email ya está en uso',
      });

      expect(mockUserRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('debe iniciar sesión exitosamente con credenciales válidas', async () => {
      const rawPassword = 'miPasswordSeguro';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      const fakeUser = {
        id: 5,
        name: 'Juan Perez',
        email: 'juan@example.com',
        password: hashedPassword,
        role: 'client',
        phone: '1122334455',
        emailNotifications: true,
        whatsappNotifications: false,
      };

      mockUserRepo.findByEmail.mockResolvedValue(fakeUser as any);

      const result = await authService.login({
        email: 'juan@example.com',
        password: rawPassword,
      });

      expect(result).toHaveProperty('token');
      expect(result.user.id).toBe(5);
      expect(result.user.email).toBe('juan@example.com');
      expect(result.user).not.toHaveProperty('password');

      // Validar que el token sea un JWT válido decodificable
      const decoded: any = jwt.decode(result.token);
      expect(decoded.id).toBe(5);
      expect(decoded.email).toBe('juan@example.com');
      expect(decoded.role).toBe('client');
    });

    it('debe lanzar AppError 401 si el usuario no existe', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'noexiste@example.com',
          password: 'password123',
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciales incorrectas',
      });
    });

    it('debe lanzar AppError 401 si la contraseña es incorrecta', async () => {
      const hashedPassword = await bcrypt.hash('passwordCorrecta', 10);

      mockUserRepo.findByEmail.mockResolvedValue({
        id: 10,
        email: 'usuario@example.com',
        password: hashedPassword,
      } as any);

      await expect(
        authService.login({
          email: 'usuario@example.com',
          password: 'passwordEquivocada',
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciales incorrectas',
      });
    });
  });

  describe('getMe', () => {
    it('debe retornar el usuario sanitizado si existe', async () => {
      mockUserRepo.findById.mockResolvedValue({
        id: 8,
        name: 'Maria Gomez',
        email: 'maria@example.com',
        password: 'hash',
        role: 'owner',
        phone: null,
        emailNotifications: true,
        whatsappNotifications: true,
      } as any);

      const user = await authService.getMe(8);
      expect(user.id).toBe(8);
      expect(user.name).toBe('Maria Gomez');
      expect(user).not.toHaveProperty('password');
    });

    it('debe lanzar AppError 404 si el usuario no existe', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(authService.getMe(999)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Usuario no encontrado',
      });
    });
  });

  describe('updateProfile', () => {
    it('debe actualizar los datos del usuario y retornarlo sanitizado', async () => {
      mockUserRepo.update.mockResolvedValue({
        id: 3,
        name: 'Nombre Actualizado',
        email: 'actualizado@example.com',
        password: 'hash',
        role: 'client',
        phone: '1199887766',
        emailNotifications: false,
        whatsappNotifications: true,
      } as any);

      const updated = await authService.updateProfile(3, {
        name: 'Nombre Actualizado',
        phone: '1199887766',
      });

      expect(mockUserRepo.update).toHaveBeenCalledWith(3, {
        name: 'Nombre Actualizado',
        phone: '1199887766',
      });
      expect(updated.name).toBe('Nombre Actualizado');
      expect(updated.phone).toBe('1199887766');
      expect(updated).not.toHaveProperty('password');
    });
  });

  describe('forgotPassword & resetPassword', () => {
    it('debe generar enlace de recuperación para un usuario existente', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({
        id: 7,
        name: 'Carlos Test',
        email: 'carlos@example.com',
        password: 'hashedPassword123',
      } as any);

      const res = await authService.forgotPassword('carlos@example.com');
      expect(res.message).toContain('Si el correo electrónico está registrado');
      expect(res.resetToken).toBeDefined();
      expect(res.resetUrl).toContain(res.resetToken);
    });

    it('debe responder genéricamente sin error si el email no existe', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      const res = await authService.forgotPassword('inexistente@example.com');
      expect(res.message).toContain('Si el correo electrónico está registrado');
      expect(res.sent).toBe(false);
    });

    it('debe restablecer la contraseña exitosamente con token válido', async () => {
      const originalPassword = 'currentPasswordHash';
      mockUserRepo.findByEmail.mockResolvedValue({
        id: 8,
        name: 'Maria Test',
        email: 'maria@example.com',
        password: originalPassword,
      } as any);

      const forgotRes = await authService.forgotPassword('maria@example.com');
      const token = forgotRes.resetToken!;

      mockUserRepo.findById.mockResolvedValue({
        id: 8,
        name: 'Maria Test',
        email: 'maria@example.com',
        password: originalPassword,
      } as any);
      mockUserRepo.update.mockResolvedValue({} as any);

      const resetRes = await authService.resetPassword(token, 'nuevaPass123');
      expect(resetRes.message).toContain('Contraseña actualizada correctamente');
      expect(mockUserRepo.update).toHaveBeenCalledWith(8, expect.objectContaining({
        password: expect.any(String),
      }));
    });
  });

  describe('loginWithGoogle', () => {
    it('debe autenticar o crear usuario con datos de Google', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue({
        id: 20,
        name: 'Google User',
        email: 'googleuser@gmail.com',
        role: 'client',
        password: 'randomHashedPassword',
      } as any);

      const res = await authService.loginWithGoogle({
        email: 'googleuser@gmail.com',
        name: 'Google User',
        googleId: '1234567890',
      });

      expect(res).toHaveProperty('token');
      expect(res.user.email).toBe('googleuser@gmail.com');
      expect(res.user.name).toBe('Google User');
      expect(mockUserRepo.create).toHaveBeenCalled();
    });
  });
});

