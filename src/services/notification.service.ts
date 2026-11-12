import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { INotificationRepository, CreateNotificationDTO } from '../interfaces/notification.interface';
import { getHoursUntilAppointment, formatTimeHelper, formatDateHelper } from '../utils/date';
import { AppError } from '../middlewares/errorHandler';
import { sendEmail } from './email.service';
import { getAppointmentReminderEmailHtml } from '../utils/emailTemplates';

export class NotificationService {
  private sseClients = new Map<number, Set<Response>>();

  constructor(
    private notificationRepo: INotificationRepository,
    private prisma: PrismaClient
  ) { }

  registerSseClient(userId: number, res: Response) {
    if (!this.sseClients.has(userId)) {
      this.sseClients.set(userId, new Set());
    }
    this.sseClients.get(userId)!.add(res);
  }

  unregisterSseClient(userId: number, res: Response) {
    const clients = this.sseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        this.sseClients.delete(userId);
      }
    }
  }

  broadcastToUser(userId: number, data: any) {
    const clients = this.sseClients.get(userId);
    if (!clients || clients.size === 0) return;

    const message = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try {
        client.write(message);
      } catch (err) {
        console.warn(`[SSE] Error enviando stream a usuario ${userId}:`, err);
      }
    }
  }

  async createNotification(data: CreateNotificationDTO) {
    const notif = await this.notificationRepo.create(data);
    try {
      const unreadCount = await this.notificationRepo.countUnread(data.userId);
      this.broadcastToUser(data.userId, {
        type: 'NEW_NOTIFICATION',
        notification: notif,
        unreadCount
      });
    } catch (err) {
      console.warn('[SSE] Error al notificar en tiempo real:', err);
    }
    return notif;
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
    try {
      const unreadCount = await this.notificationRepo.countUnread(userId);
      this.broadcastToUser(userId, {
        type: 'UPDATE_UNREAD',
        readId: id,
        unreadCount
      });
    } catch { }
    return notif;
  }

  async markAllAsRead(userId: number) {
    const count = await this.notificationRepo.markAllAsRead(userId);
    try {
      this.broadcastToUser(userId, {
        type: 'ALL_READ',
        unreadCount: 0
      });
    } catch { }
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
            const frontendUrl = process.env.FRONTEND_URL || 'https://turnos-ya-frontend-web-delta.vercel.app';
            sendEmail({
              to: app.user.email,
              subject: `Recordatorio: tu turno en ${businessName} es en 1 hora - Turnos Ya`,
              html: getAppointmentReminderEmailHtml({
                clientName: app.user.name,
                businessName,
                serviceName,
                timeFormatted,
                frontendUrl,
              }),
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
