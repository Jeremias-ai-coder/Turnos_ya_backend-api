import { PrismaClient } from '@prisma/client';
import { IReviewRepository, CreateReviewDTO } from '../interfaces/review.interface';
import { IAppointmentRepository } from '../interfaces/appointment.interface';
import { AppError } from '../middlewares/errorHandler';
import { getPaginationOptions, createPaginatedResponse } from '../utils/pagination';
import { prisma as defaultPrisma } from '../config/prisma';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { cacheService } from './cache.service';

export class ReviewService {
  private tableInitialized = false;

  constructor(
    private reviewRepo: IReviewRepository,
    private appointmentRepo: IAppointmentRepository,
    private prisma: PrismaClient = defaultPrisma,
    private auditService?: AuditService,
    private notificationService?: NotificationService,
    private cache = cacheService
  ) {}

  private async ensureTable() {
    if (this.tableInitialized) return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS hidden_reviews (
          review_id INT PRIMARY KEY,
          hidden_reason VARCHAR(255) NULL,
          hidden_by INT NOT NULL,
          hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.tableInitialized = true;
    } catch (err) {
      console.warn('[REVIEWS] Warning al verificar tabla hidden_reviews:', err);
    }
  }

  private async getHiddenReviewMap(): Promise<Map<number, string>> {
    await this.ensureTable();
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT review_id as reviewId, hidden_reason as hiddenReason FROM hidden_reviews
      `);
      const map = new Map<number, string>();
      for (const r of rows) {
        map.set(Number(r.reviewId), r.hiddenReason || '');
      }
      return map;
    } catch {
      return new Map();
    }
  }

  async createReview(userId: number, appointmentId: number, data: CreateReviewDTO) {
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) {
      throw new AppError('Turno no encontrado', 404);
    }

    if (appointment.userId !== userId) {
      throw new AppError('No tienes permiso para calificar un turno de otro usuario', 403);
    }

    if (appointment.status !== 'COMPLETED') {
      throw new AppError('Solo se pueden calificar turnos que hayan sido completados por el comercio', 400);
    }

    const existingReview = await this.reviewRepo.findByAppointmentId(appointmentId);
    if (existingReview) {
      throw new AppError('Este turno ya ha sido calificado previamente', 400);
    }

    const created = await this.reviewRepo.create(appointmentId, data);
    this.cache.delPattern(`business:${appointment.businessId}:*`);

    if (this.notificationService && appointment.business?.ownerId) {
      const clientName = appointment.user?.name || 'Un cliente';
      const businessName = appointment.business?.name || 'tu comercio';
      await this.notificationService.createNotification({
        userId: appointment.business.ownerId,
        title: 'Nueva opinión recibida',
        message: `${clientName} calificó con ${data.rating} ★ su atención en "${businessName}".`,
        type: 'NEW_REVIEW'
      }).catch(err => console.warn('[REVIEWS] Error notificando nueva reseña al dueño:', err));
    }

    return created;
  }

  async getBusinessReviews(businessId: number, page: number = 1, limit: number = 10, includeHidden: boolean = false) {
    const pagination = getPaginationOptions(page, limit, 50);
    const hiddenMap = await this.getHiddenReviewMap();

    const [allReviews, total] = await this.reviewRepo.findByBusinessId(
      businessId,
      pagination.skip,
      pagination.limit
    );

    // Calcular estadísticas excluyendo reseñas ocultas
    const visibleForStats = allReviews.filter((r) => !hiddenMap.has(r.id));
    const stats = {
      average:
        visibleForStats.length > 0
          ? Number((visibleForStats.reduce((acc, curr) => acc + curr.rating, 0) / visibleForStats.length).toFixed(1))
          : 5.0,
      count: visibleForStats.length,
    };

    if (includeHidden) {
      const mapped = allReviews.map((r) => ({
        ...r,
        isHidden: hiddenMap.has(r.id),
        hiddenReason: hiddenMap.get(r.id) || null,
      }));
      const response = createPaginatedResponse(mapped, total, pagination.page, pagination.limit);
      return { ...response, stats };
    }

    // Para el público general: solo reseñas visibles
    const visibleReviews = allReviews
      .filter((r) => !hiddenMap.has(r.id))
      .map((r) => ({
        ...r,
        isHidden: false,
        hiddenReason: null,
      }));

    const response = createPaginatedResponse(visibleReviews, visibleReviews.length, pagination.page, pagination.limit);
    return { ...response, stats };
  }

  async hideReviewByAdmin(reviewId: number, adminId: number, adminName: string, reason?: string) {
    await this.ensureTable();
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new AppError('Reseña no encontrada', 404);
    }

    const cleanReason = reason?.trim() || 'Ocultada por moderación administrativa';

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO hidden_reviews (review_id, hidden_reason, hidden_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE hidden_reason = VALUES(hidden_reason), hidden_by = VALUES(hidden_by)`,
      reviewId,
      cleanReason,
      adminId
    );

    if (this.auditService) {
      await this.auditService.recordLog({
        adminId,
        adminName,
        action: 'REVIEW_HIDDEN',
        targetType: 'Review',
        targetId: reviewId,
        details: `Reseña ocultada de la vista pública. Motivo: ${cleanReason}`,
      });
    }

    this.cache.delPattern('business:*');
    this.cache.delPattern('reviews:*');

    return {
      success: true,
      message: 'Reseña ocultada de la vista pública exitosamente',
      reviewId,
      isHidden: true,
      hiddenReason: cleanReason,
    };
  }

  async unhideReviewByAdmin(reviewId: number, adminId: number, adminName: string) {
    await this.ensureTable();
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new AppError('Reseña no encontrada', 404);
    }

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM hidden_reviews WHERE review_id = ?`,
      reviewId
    );

    if (this.auditService) {
      await this.auditService.recordLog({
        adminId,
        adminName,
        action: 'REVIEW_UNHIDDEN',
        targetType: 'Review',
        targetId: reviewId,
        details: 'Reseña restaurada a visibilidad pública',
      });
    }

    this.cache.delPattern('business:*');
    this.cache.delPattern('reviews:*');

    return {
      success: true,
      message: 'Reseña restaurada a visibilidad pública exitosamente',
      reviewId,
      isHidden: false,
    };
  }

  async deleteReviewByAdmin(reviewId: number, adminId: number, adminName: string, reason?: string) {
    await this.ensureTable();
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new AppError('Reseña no encontrada', 404);
    }

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM hidden_reviews WHERE review_id = ?`,
      reviewId
    ).catch(() => {});

    const deleted = await this.reviewRepo.delete(reviewId);

    if (this.auditService) {
      await this.auditService.recordLog({
        adminId,
        adminName,
        action: 'REVIEW_DELETED',
        targetType: 'Review',
        targetId: reviewId,
        details: reason ? `Reseña eliminada permanentemente. Motivo: ${reason}` : 'Reseña eliminada permanentemente',
      });
    }

    this.cache.delPattern('business:*');
    this.cache.delPattern('reviews:*');

    return {
      message: 'Reseña eliminada permanentemente por administración',
      review: deleted,
    };
  }
}
