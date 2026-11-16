import { IServiceRepository, CreateServiceDTO } from '../interfaces/service.interface';
import { IBusinessRepository } from '../interfaces/business.interface';
import { AppError } from '../middlewares/errorHandler';
import { CacheService, cacheService } from './cache.service';

export class ServiceService {
  constructor(
    private serviceRepo: IServiceRepository,
    private businessRepo: IBusinessRepository,
    private cache: CacheService = cacheService
  ) {}

  async getServices(businessId: number) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    return this.serviceRepo.findByBusinessId(businessId);
  }

  async createService(businessId: number, userId: number, data: CreateServiceDTO) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    if (business.ownerId !== userId) {
      throw new AppError('No tienes permiso para agregar servicios a este negocio', 403);
    }

    const created = await this.serviceRepo.create(businessId, data);
    await Promise.all([
      this.cache.del(`business:detail:${businessId}`),
      this.cache.delPattern('businesses:list:*'),
      this.cache.delPattern(`slots:${businessId}:*`),
    ]);
    return created;
  }

  async updateService(
    businessId: number,
    serviceId: number,
    user: { id: number; role: string },
    data: Partial<CreateServiceDTO>
  ) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    if (business.ownerId !== user.id && user.role !== 'administrator') {
      throw new AppError('No tienes permiso para modificar servicios de este negocio', 403);
    }

    const existingService = await this.serviceRepo.findById(serviceId);
    if (!existingService || existingService.businessId !== businessId) {
      throw new AppError('Servicio no encontrado en este negocio', 404);
    }

    const updated = await this.serviceRepo.update(serviceId, data);
    await Promise.all([
      this.cache.del(`business:detail:${businessId}`),
      this.cache.delPattern('businesses:list:*'),
      this.cache.delPattern(`slots:${businessId}:*`),
    ]);
    return updated;
  }

  async deleteService(businessId: number, serviceId: number, user: { id: number; role: string }) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    if (business.ownerId !== user.id && user.role !== 'administrator') {
      throw new AppError('No autorizado', 403);
    }

    const existingService = await this.serviceRepo.findById(serviceId);
    if (!existingService || existingService.businessId !== businessId) {
      throw new AppError('Servicio no encontrado en este negocio', 404);
    }

    await this.serviceRepo.delete(serviceId);
    await Promise.all([
      this.cache.del(`business:detail:${businessId}`),
      this.cache.delPattern('businesses:list:*'),
      this.cache.delPattern(`slots:${businessId}:*`),
    ]);
    return { message: 'Servicio eliminado correctamente' };
  }
}
