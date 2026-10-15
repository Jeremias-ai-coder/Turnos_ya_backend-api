import { BusinessService } from './business.service';
import { IBusinessRepository } from '../interfaces/business.interface';
import { IUserRepository } from '../interfaces/user.interface';
import { AppError } from '../middlewares/errorHandler';

describe('BusinessService (Unit Tests)', () => {
  let businessService: BusinessService;
  let mockBusinessRepo: jest.Mocked<IBusinessRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockBusinessRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<IBusinessRepository>;

    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    businessService = new BusinessService(mockBusinessRepo, mockUserRepo);
  });

  describe('getBusinesses', () => {
    it('debe retornar la lista paginada de negocios', async () => {
      const fakeBusinesses = [
        { id: 1, name: 'Barbería Premium', category: 'Barbería' },
        { id: 2, name: 'Peluquería Estilo', category: 'Peluquería' },
      ];
      mockBusinessRepo.findAll.mockResolvedValue([fakeBusinesses as any, 2]);

      const result = await businessService.getBusinesses(1, 10, 'Barbería');

      expect(mockBusinessRepo.findAll).toHaveBeenCalledWith(0, 10, 'Barbería');
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('getBusinessById', () => {
    it('debe retornar el negocio si existe', async () => {
      const fakeBusiness = { id: 1, name: 'Barbería Premium', ownerId: 5 };
      mockBusinessRepo.findById.mockResolvedValue(fakeBusiness as any);

      const result = await businessService.getBusinessById(1);

      expect(mockBusinessRepo.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(fakeBusiness);
    });

    it('debe lanzar error 404 si el negocio no existe', async () => {
      mockBusinessRepo.findById.mockResolvedValue(null);

      await expect(businessService.getBusinessById(999)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Negocio no encontrado',
      });
    });
  });

  describe('createBusiness', () => {
    it('debe crear el negocio y promover al usuario de cliente a dueño (owner)', async () => {
      const newBusinessData = { name: 'Mi Nuevo Negocio', address: 'Av. Corrientes 1234' };
      const createdBusiness = { id: 10, ...newBusinessData, ownerId: 7 };

      mockBusinessRepo.create.mockResolvedValue(createdBusiness as any);
      mockUserRepo.findById.mockResolvedValue({ id: 7, role: 'client' } as any);
      mockUserRepo.update.mockResolvedValue({ id: 7, role: 'owner' } as any);

      const result = await businessService.createBusiness(7, newBusinessData as any);

      expect(mockBusinessRepo.create).toHaveBeenCalledWith(7, newBusinessData);
      expect(mockUserRepo.findById).toHaveBeenCalledWith(7);
      expect(mockUserRepo.update).toHaveBeenCalledWith(7, { role: 'owner' });
      expect(result).toEqual(createdBusiness);
    });

    it('debe crear el negocio sin alterar el rol si el usuario ya es owner o admin', async () => {
      const newBusinessData = { name: 'Segundo Local', address: 'Palermo 500' };
      const createdBusiness = { id: 11, ...newBusinessData, ownerId: 7 };

      mockBusinessRepo.create.mockResolvedValue(createdBusiness as any);
      mockUserRepo.findById.mockResolvedValue({ id: 7, role: 'owner' } as any);

      const result = await businessService.createBusiness(7, newBusinessData as any);

      expect(mockBusinessRepo.create).toHaveBeenCalledWith(7, newBusinessData);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
      expect(result).toEqual(createdBusiness);
    });
  });

  describe('getMyBusinesses', () => {
    it('debe retornar todos los negocios pertenecientes al usuario especificado', async () => {
      const ownerBusinesses = [
        { id: 1, name: 'Local A', ownerId: 4 },
        { id: 2, name: 'Local B', ownerId: 4 },
      ];
      mockBusinessRepo.findByOwnerId.mockResolvedValue(ownerBusinesses as any);

      const result = await businessService.getMyBusinesses(4);

      expect(mockBusinessRepo.findByOwnerId).toHaveBeenCalledWith(4);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('updateBusiness', () => {
    it('debe permitir la actualización si el usuario es el dueño legítimo del comercio', async () => {
      const existing = { id: 5, name: 'Barbería', ownerId: 8 };
      mockBusinessRepo.findById.mockResolvedValue(existing as any);
      mockBusinessRepo.update.mockResolvedValue({ ...existing, name: 'Barbería Renombrada' } as any);

      const result = await businessService.updateBusiness(5, 8, 'owner', { name: 'Barbería Renombrada' });

      expect(mockBusinessRepo.update).toHaveBeenCalledWith(5, { name: 'Barbería Renombrada' });
      expect(result.name).toBe('Barbería Renombrada');
    });

    it('debe permitir la actualización a un administrador aunque no sea el dueño', async () => {
      const existing = { id: 5, name: 'Barbería', ownerId: 8 };
      mockBusinessRepo.findById.mockResolvedValue(existing as any);
      mockBusinessRepo.update.mockResolvedValue({ ...existing, name: 'Editada por Admin' } as any);

      const result = await businessService.updateBusiness(5, 1, 'administrator', { name: 'Editada por Admin' });

      expect(mockBusinessRepo.update).toHaveBeenCalledWith(5, { name: 'Editada por Admin' });
      expect(result.name).toBe('Editada por Admin');
    });

    it('debe rechazar con 403 si el usuario no es el dueño ni administrador', async () => {
      const existing = { id: 5, name: 'Barbería', ownerId: 8 };
      mockBusinessRepo.findById.mockResolvedValue(existing as any);

      await expect(
        businessService.updateBusiness(5, 999, 'client', { name: 'Intento Ilegítimo' })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'No autorizado',
      });

      expect(mockBusinessRepo.update).not.toHaveBeenCalled();
    });

    it('debe rechazar con 404 si el negocio no existe al intentar actualizarlo', async () => {
      mockBusinessRepo.findById.mockResolvedValue(null);

      await expect(
        businessService.updateBusiness(999, 1, 'administrator', { name: 'X' })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Negocio no encontrado',
      });
    });
  });
});
