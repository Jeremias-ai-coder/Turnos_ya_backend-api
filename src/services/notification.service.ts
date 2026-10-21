import { PrismaClient } from '@prisma/client';
import { INotificationRepository, CreateNotificationDTO } from '../interfaces/notification.interface';
import { getHoursUntilAppointment, formatTimeHelper, formatDateHelper } from '../utils/date';
import { AppError } from '../middlewares/errorHandler';
import { sendEmail } from './email.service';

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
          user: { select: { id: true, name: true, email: true, emailNotifications: true } }
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

          // 1. Notificación en la plataforma
          await this.createNotification({
            userId: app.userId,
            title: 'Recordatorio de turno en 1 hora',
            message: `Recuerda que tienes un turno para "${serviceName}" en ${businessName} hoy a las ${timeFormatted} hs. ¡Te esperamos!`,
            type: 'APPOINTMENT_REMINDER'
          });

          // 2. Notificación por correo electrónico si está habilitado
          if (app.user?.email && app.user.emailNotifications !== false) {
            sendEmail({
              to: app.user.email,
              subject: `Recordatorio: tu turno en ${businessName} es en 1 hora - Turnos Ya`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #009ee3; margin: 0; font-size: 24px;">Turnos Ya</h1>
                    <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Recordatorio de turno</p>
                  </div>
                  <p style="font-size: 15px; color: #1e293b;">Hola <strong>${app.user.name}</strong>,</p>
                  <p style="font-size: 14px; color: #475569; line-height: 1.5;">
                    Te recordamos que tienes una cita programada para dentro de aproximadamente 1 hora:
                  </p>
                  <div style="background: #f8fafc; border-left: 4px solid #009ee3; padding: 14px 16px; margin: 18px 0; border-radius: 4px;">
                    <p style="margin: 0 0 6px 0; font-size: 14px;"><strong>Negocio:</strong> ${businessName}</p>
                    <p style="margin: 0 0 6px 0; font-size: 14px;"><strong>Servicio:</strong> ${serviceName}</p>
                    <p style="margin: 0; font-size: 14px;"><strong>Hora:</strong> ${timeFormatted} hs</p>
                  </div>
                  <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
                    ¡Te esperamos puntual! Si necesitas cancelar o reprogramar, ingresa a tu panel de Turnos Ya.
                  </p>
                </div>
              `,
            }).catch(err => console.error('[EMAIL] Error enviando email de recordatorio:', err));
          }

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
