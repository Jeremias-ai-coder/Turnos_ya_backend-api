import { BugReportStatus, PrismaClient } from '@prisma/client';
import { PrismaBugReportRepository, CreateBugReportDTO } from '../repositories/prisma-bug-report.repository';
import { AppError } from '../middlewares/errorHandler';
import { NotificationService } from './notification.service';
import { prisma as defaultPrisma } from '../config/prisma';

export class BugReportService {
  constructor(
    private bugReportRepository: PrismaBugReportRepository,
    private notificationService?: NotificationService,
    private prisma: PrismaClient = defaultPrisma
  ) {}

  async createReport(data: CreateBugReportDTO) {
    if (!data.section || !data.section.trim()) {
      throw new AppError('El campo "¿Dónde te has encontrado el error?" es obligatorio', 400);
    }
    if (!data.summary || !data.summary.trim()) {
      throw new AppError('El resumen del error es obligatorio', 400);
    }
    if (!data.steps || !data.steps.trim()) {
      throw new AppError('Los pasos para reproducir el error son obligatorios', 400);
    }

    const created = await this.bugReportRepository.create({
      userId: data.userId,
      section: data.section.trim(),
      summary: data.summary.trim(),
      steps: data.steps.trim(),
      deviceInfo: data.deviceInfo?.trim() || undefined,
      pageUrl: data.pageUrl?.trim() || undefined,
    });

    if (this.notificationService) {
      try {
        const admins = await this.prisma.user.findMany({
          where: { role: 'administrator', deletedAt: null },
          select: { id: true }
        });
        const cleanSection = data.section.trim();
        const title =
          cleanSection === 'SOLICITUD_RUBRO'
            ? 'Nueva solicitud de rubro comercial'
            : cleanSection === 'MODERACION_RESENA'
            ? 'Nuevo reclamo de moderación de reseña'
            : 'Nuevo ticket de soporte técnico';

        for (const admin of admins) {
          await this.notificationService.createNotification({
            userId: admin.id,
            title,
            message: `Ticket #${created.id}: ${data.summary.trim()}`,
            type: 'ADMIN_NEW_TICKET'
          });
        }
      } catch (err) {
        console.warn('[BUG_REPORT] Error notificando a administradores:', err);
      }
    }

    return created;
  }

  async getAllReports(options: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    let validStatus: BugReportStatus | undefined;
    if (options.status && ['PENDING', 'IN_REVIEW', 'RESOLVED', 'DISCARDED'].includes(options.status)) {
      validStatus = options.status as BugReportStatus;
    }

    const [{ reports, total }, counts] = await Promise.all([
      this.bugReportRepository.findAll({ status: validStatus, skip, take: limit }),
      this.bugReportRepository.countByStatus(),
    ]);

    return {
      data: reports,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts,
    };
  }

  async updateReportStatus(id: number, status: string, adminNotes?: string) {
    const validStatuses: BugReportStatus[] = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'DISCARDED'];
    if (!validStatuses.includes(status as BugReportStatus)) {
      throw new AppError(`Estado inválido. Opciones permitidas: ${validStatuses.join(', ')}`, 400);
    }

    const existing = await this.bugReportRepository.findById(id);
    if (!existing) {
      throw new AppError('Reporte de error no encontrado', 404);
    }

    const updated = await this.bugReportRepository.updateStatus(id, status as BugReportStatus, adminNotes);

    if (this.notificationService && existing.userId) {
      const statusLabels: Record<string, string> = {
        PENDING: 'Pendiente',
        IN_REVIEW: 'En revisión por el equipo de soporte',
        RESOLVED: 'Resuelto / Aprobado',
        DISCARDED: 'Desestimado / Cerrado'
      };
      const statusText = statusLabels[status] || status;
      const notesText = adminNotes?.trim() ? ` Respuesta de administración: "${adminNotes.trim()}"` : '';

      const notifType =
        existing.section === 'SOLICITUD_RUBRO'
          ? 'RUBRO_TICKET_UPDATED'
          : existing.section === 'MODERACION_RESENA'
          ? 'RESENA_TICKET_UPDATED'
          : 'TICKET_UPDATED';

      await this.notificationService.createNotification({
        userId: existing.userId,
        title: `Actualización de tu solicitud #${id}`,
        message: `Tu ticket "${existing.summary}" pasó al estado: ${statusText}.${notesText}`,
        type: notifType
      }).catch(err => console.error('[BUG_REPORT] Error enviando notificación al creador del ticket:', err));
    }

    return updated;
  }
}
