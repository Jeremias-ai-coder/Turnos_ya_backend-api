import { PrismaClient } from '@prisma/client';
import { INotificationRepository, CreateNotificationDTO } from '../interfaces/notification.interface';
import { getHoursUntilAppointment, formatTimeHelper, formatDateHelper } from '../utils/date';
export { formatTimeHelper, formatDateHelper } from '../utils/date';
import { AppError } from '../middlewares/errorHandler';

export class NotificationService {
  constructor(
    private notificationRepo: INotificationRepository,
    private prisma: PrismaClient
  ) {}

  async createNotification(data: CreateNotificationDTO) {
    return this.notificationRepo.create(data);
  }

  async getUserNotifications(userId: number, limit: number = 30, skip: number = 0) {
    const [notifications, total] = await this.notificationRepo.findByUserId(userId, limit, skip);
    const unreadCount = await this.notificationRepo.countUnread(userId);

    return {
      notifications,
      total,
      unreadCount
    };
  }

  async markAsRead(id: number, userId: number) {
    const notif = await this.notificationRepo.markAsRead(id, userId);
    if (!notif) {
      throw new AppError('Notificación no encontrada', 404);
    }
    return notif;
  }

  async markAllAsRead(userId: number) {
    const count = await this.notificationRepo.markAllAsRead(userId);
    return { count };
  }

  /**
   * Revisa turnos confirmados programados para dentro de 1 hora
   * y genera la notificación de recordatorio correspondiente.
   */
  async checkAndSendHourlyReminders() {
    try {
      // Buscar turnos confirmados pendientes de recordatorio
      const pendingAppointments = await this.prisma.appointment.findMany({
        where: {
          status: 'CONFIRMED',
          reminder1hSent: false
        },
        include: {
          service: true,
          business: true,
          user: { select: { id: true, name: true, email: true } }
        }
      });

      for (const app of pendingAppointments) {
        const hoursUntil = getHoursUntilAppointment(app.date, app.time);

        // Si ya transcurrió, marcamos como enviado para no procesarlo más
        if (hoursUntil <= 0) {
          await this.prisma.appointment.update({
            where: { id: app.id },
            data: { reminder1hSent: true }
          });
          continue;
        }

        // Si faltan entre 0 y 65 minutos (~1 hora antes)
        if (hoursUntil <= 1.08) {
          const timeFormatted = formatTimeHelper(app.time);
          const serviceName = app.service?.name || 'Servicio';
          const businessName = app.business?.name || 'el negocio';

          await this.createNotification({
            userId: app.userId,
            title: 'Recordatorio de turno en 1 hora',
            message: `Recuerda que tienes un turno para "${serviceName}" en ${businessName} hoy a las ${timeFormatted} hs. ¡Te esperamos!`,
            type: 'APPOINTMENT_REMINDER'
          });

          await this.prisma.appointment.update({
            where: { id: app.id },
            data: { reminder1hSent: true }
          });
        }
      }
    } catch (error) {
      console.error('Error al verificar recordatorios de turnos:', error);
    }
  }
}
