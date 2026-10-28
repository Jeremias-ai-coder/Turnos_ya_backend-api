import { IScheduleRepository, CreateScheduleDTO } from '../interfaces/schedule.interface';
import { IBusinessRepository } from '../interfaces/business.interface';
import { AppError } from '../middlewares/errorHandler';
import { parseTimeToUTC } from '../utils/date';
import { CacheService, cacheService } from './cache.service';

export class ScheduleService {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private businessRepo: IBusinessRepository,
    private cache: CacheService = cacheService
  ) {}

  async getSchedules(businessId: number) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    return this.cache.getOrSet(
      `business:schedules:${businessId}`,
      async () => {
        return this.scheduleRepo.findByBusinessId(businessId);
      },
      600 // 10 minutos TTL
    );
  }

  async createSchedule(businessId: number, userId: number, data: { dayOfWeek: number; startTime: string; endTime: string }) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    if (business.ownerId !== userId) {
      throw new AppError('No tienes permiso para modificar horarios de este negocio', 403);
    }

    const created = await this.scheduleRepo.create({
      businessId,
      dayOfWeek: data.dayOfWeek,
      startTime: parseTimeToUTC(data.startTime),
      endTime: parseTimeToUTC(data.endTime)
    });

    // Invalidar horarios y slots del negocio
    await Promise.all([
      this.cache.del(`business:schedules:${businessId}`),
      this.cache.delPattern(`slots:${businessId}:*`)
    ]);

    return created;
  }

  async updateSchedule(
    businessId: number,
    scheduleId: number,
    user: { id: number; role: string },
    data: { dayOfWeek?: number; startTime?: string; endTime?: string }
  ) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    if (business.ownerId !== user.id && user.role !== 'administrator') {
      throw new AppError('No tienes permiso para modificar horarios de este negocio', 403);
    }

    const existingSchedule = await this.scheduleRepo.findById(scheduleId);
    if (!existingSchedule || existingSchedule.businessId !== businessId) {
      throw new AppError('Horario no encontrado en este negocio', 404);
    }

    const updated = await this.scheduleRepo.update(scheduleId, {
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime ? parseTimeToUTC(data.startTime) : undefined,
      endTime: data.endTime ? parseTimeToUTC(data.endTime) : undefined
    });

    // Invalidar horarios y slots del negocio
    await Promise.all([
      this.cache.del(`business:schedules:${businessId}`),
      this.cache.delPattern(`slots:${businessId}:*`)
    ]);

    return updated;
  }

  async deleteSchedule(businessId: number, scheduleId: number, user: { id: number; role: string }) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    if (business.ownerId !== user.id && user.role !== 'administrator') {
      throw new AppError('No autorizado', 403);
    }

    await this.scheduleRepo.delete(scheduleId);

    // Invalidar horarios y slots del negocio
    await Promise.all([
      this.cache.del(`business:schedules:${businessId}`),
      this.cache.delPattern(`slots:${businessId}:*`)
    ]);

    return { message: 'Horario eliminado correctamente' };
  }
}
