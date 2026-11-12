import { AdminService, ROOT_ADMIN_EMAILS, isRootAdminEmail } from './admin.service';
import { IUserRepository } from '../interfaces/user.interface';
import { IBusinessRepository } from '../interfaces/business.interface';
import { IAppointmentRepository } from '../interfaces/appointment.interface';
import { AppError } from '../middlewares/errorHandler';
import { CacheService } from './cache.service';

describe('AdminService - Root Protection & RBAC Hierarchy', () => {
  let adminService: AdminService;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockBusinessRepo: jest.Mocked<IBusinessRepository>;
  let mockAppointmentRepo: jest.Mocked<IAppointmentRepository>;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    } as any;

    mockBusinessRepo = {
      count: jest.fn(),
    } as any;

    mockAppointmentRepo = {
      count: jest.fn(),
      findAll: jest.fn(),
    } as any;

    mockCache = {
      del: jest.fn().mockResolvedValue(true),
      getOrSet: jest.fn(),
      getStats: jest.fn(),
      clear: jest.fn().mockResolvedValue(undefined),
    } as any;

    adminService = new AdminService(
      mockUserRepo,
      mockBusinessRepo,
      mockAppointmentRepo,
      undefined,
      mockCache
    );
  });

  describe('isRootAdminEmail', () => {
    it('debe identificar turnosyapp@gmail.com como cuenta raíz', () => {
      expect(isRootAdminEmail('turnosyapp@gmail.com')).toBe(true);
      expect(isRootAdminEmail('TURNOSYAPP@GMAIL.COM ')).toBe(true);
    });

    it('debe identificar jeremiascollaud@gmail.com como cuenta raíz', () => {
      expect(isRootAdminEmail('jeremiascollaud@gmail.com')).toBe(true);
    });

    it('debe retornar false para usuarios comunes o administradores secundarios', () => {
      expect(isRootAdminEmail('otro.admin@turnosya.com')).toBe(false);
      expect(isRootAdminEmail('cliente@example.com')).toBe(false);
      expect(isRootAdminEmail(null)).toBe(false);
      expect(isRootAdminEmail(undefined)).toBe(false);
    });
  });

  describe('deleteUser - Inmunidad de la Cuenta Raíz y Reglas de Seguridad', () => {
    it('debe rechazar la eliminación de la cuenta raíz turnosyapp@gmail.com con 403', async () => {
      mockUserRepo.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Turnos Ya Master',
        email: 'turnosyapp@gmail.com',
        role: 'administrator',
      } as any);

      await expect(adminService.deleteUser(1, 99)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('inmutable y está estrictamente protegida'),
      });
      expect(mockUserRepo.delete).not.toHaveBeenCalled();
    });

    it('debe rechazar la auto-eliminación de un administrador con 400', async () => {
      mockUserRepo.findById.mockResolvedValueOnce({
        id: 2,
        name: 'Admin Secundario',
        email: 'admin2@test.com',
        role: 'administrator',
      } as any);

      await expect(adminService.deleteUser(2, 2)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('eliminar tu propia cuenta'),
      });
      expect(mockUserRepo.delete).not.toHaveBeenCalled();
    });

    it('debe impedir que un administrador común elimine a otro administrador', async () => {
      // Target admin
      mockUserRepo.findById.mockResolvedValueOnce({
        id: 5,
        name: 'Colega Admin',
        email: 'colega@test.com',
        role: 'administrator',
      } as any);

      // Executor admin (no raíz)
      mockUserRepo.findById.mockResolvedValueOnce({
        id: 2,
        name: 'Admin Común',
        email: 'admin.comun@test.com',
        role: 'administrator',
      } as any);

      await expect(adminService.deleteUser(5, 2)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Solo el Administrador Principal (Cuenta Raíz)'),
      });
      expect(mockUserRepo.delete).not.toHaveBeenCalled();
    });

    it('debe permitir que la Cuenta Raíz elimine a un administrador secundario', async () => {
      // Target admin
      mockUserRepo.findById.mockResolvedValueOnce({
        id: 5,
        name: 'Admin Secundario',
        email: 'secundario@test.com',
        role: 'administrator',
      } as any);

      // Executor (Root)
      mockUserRepo.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Turnos Ya Raíz',
        email: 'turnosyapp@gmail.com',
        role: 'administrator',
      } as any);

      mockUserRepo.delete.mockResolvedValueOnce({} as any);

      const res = await adminService.deleteUser(5, 1);
      expect(res).toEqual({ message: 'Usuario eliminado correctamente' });
      expect(mockUserRepo.delete).toHaveBeenCalledWith(5);
      expect(mockCache.del).toHaveBeenCalledWith('admin:stats');
    });

    it('debe permitir que un administrador elimine a un cliente común', async () => {
      mockUserRepo.findById.mockResolvedValueOnce({
        id: 10,
        name: 'Cliente Spam',
        email: 'spam@mail.com',
        role: 'client',
      } as any);

      mockUserRepo.delete.mockResolvedValueOnce({} as any);

      const res = await adminService.deleteUser(10, 2);
      expect(res).toEqual({ message: 'Usuario eliminado correctamente' });
      expect(mockUserRepo.delete).toHaveBeenCalledWith(10);
    });
  });

  describe('updateUserRole - Inmunidad y Jerarquía', () => {
    it('debe impedir modificar el rol de la Cuenta Raíz', async () => {
      mockUserRepo.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Turnos Ya Master',
        email: 'turnosyapp@gmail.com',
        role: 'administrator',
      } as any);

      await expect(adminService.updateUserRole(1, 'client', 99)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('inmutable y está protegido'),
      });
    });

    it('debe impedir que un admin común promueva a otro a administrador', async () => {
      mockUserRepo.findById.mockResolvedValueOnce({
        id: 10,
        name: 'Juan Perez',
        email: 'juan@test.com',
        role: 'client',
      } as any);

      mockUserRepo.findById.mockResolvedValueOnce({
        id: 2,
        name: 'Admin Común',
        email: 'comun@test.com',
        role: 'administrator',
      } as any);

      await expect(adminService.updateUserRole(10, 'administrator', 2)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Solo el Administrador Principal (Cuenta Raíz)'),
      });
    });
  });
});
