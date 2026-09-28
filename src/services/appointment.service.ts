import crypto from 'crypto';
import { AppointmentStatus } from '@prisma/client';
import { IAppointmentRepository } from '../interfaces/appointment.interface';
import { IServiceRepository } from '../interfaces/service.interface';
import { NotificationService, formatDateHelper, formatTimeHelper } from './notification.service';
import { WebhookService } from '../infrastructure/webhook.service';
import { AppError } from '../middlewares/errorHandler';
import { getPaginationOptions, createPaginatedResponse } from '../utils/pagination';
import { getHoursUntilAppointment, combineDateAndTime, parseTimeToUTC } from '../utils/date';

export interface GetAppointmentsParams {
  userId: number;
  userRole: string;
  page?: number;
  limit?: number;
  businessId?: number;
  date?: string;
}

export class AppointmentService {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private serviceRepo?: IServiceRepository,
    private notificationService?: NotificationService
  ) {}


  async holdAppointment(userId: number, data: { businessId: number; serviceId: number; date: string; time: string }) {
    // 1. Validar que la fecha y hora sean futuras
    const appointmentStart = combineDateAndTime(data.date, data.time);
    if (appointmentStart <= new Date()) {
      throw new AppError('No es posible reservar un turno en una fecha u horario que ya ha transcurrido', 400);
    }

    const dateUtc = new Date(data.date.includes('T') ? data.date : `${data.date}T00:00:00.000Z`);
    const timeUtc = parseTimeToUTC(data.time);

    let durationMinutes = 30;
    if (this.serviceRepo) {
      const service = await this.serviceRepo.findById(data.serviceId);
      if (service) durationMinutes = service.durationMinutes;
    }

    // 2. Validar que el horario no esté ocupado por otro usuario
    const isBusy = await this.appointmentRepo.isSlotBusy(data.businessId, dateUtc, timeUtc, durationMinutes, userId);
    if (isBusy) {
      throw new AppError('El horario seleccionado ya no se encuentra disponible', 400);
    }

    // 3. Limpiar bloqueos temporales previos del mismo usuario
    await this.appointmentRepo.clearPendingHolds(userId);

    const holdToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos TTL

    await this.appointmentRepo.createHold({
      businessId: data.businessId,
      serviceId: data.serviceId,
      userId,
      date: dateUtc,
      time: timeUtc,
      holdToken,
      holdExpiresAt: expiresAt
    });

    return {
      holdToken,
      expiresAt: expiresAt.toISOString()
    };
  }

  async createAppointment(userId: number, data: { businessId: number; serviceId: number; date: string; time: string; holdToken?: string }) {
    if (data.holdToken) {
      const existingHold = await this.appointmentRepo.findByHoldToken(data.holdToken);

      if (!existingHold || (existingHold.holdExpiresAt && existingHold.holdExpiresAt < new Date())) {
        throw new AppError('El bloqueo temporal del turno ha expirado o es inválido', 400);
      }

      const confirmed = await this.appointmentRepo.confirmAppointment(existingHold.id);
      WebhookService.dispatch('appointment.created', data.businessId, confirmed);

      // Enviar notificaciones a cliente y owner
      this.triggerAppointmentNotifications(confirmed.id).catch(err =>
        console.error('Error enviando notificaciones de reserva:', err)
      );

      return confirmed;
    }

    // Reserva directa sin hold
    const appointmentStart = combineDateAndTime(data.date, data.time);
    if (appointmentStart <= new Date()) {
      throw new AppError('No es posible reservar un turno en una fecha u horario que ya ha transcurrido', 400);
    }

    const dateUtc = new Date(data.date.includes('T') ? data.date : `${data.date}T00:00:00.000Z`);
    const timeUtc = parseTimeToUTC(data.time);

    let durationMinutes = 30;
    if (this.serviceRepo) {
      const service = await this.serviceRepo.findById(data.serviceId);
      if (service) durationMinutes = service.durationMinutes;
    }

    const isBusy = await this.appointmentRepo.isSlotBusy(data.businessId, dateUtc, timeUtc, durationMinutes, userId);
    if (isBusy) {
      throw new AppError('El horario seleccionado ya no se encuentra disponible', 400);
    }

    const appointment = await this.appointmentRepo.createDirect({
      businessId: data.businessId,
      serviceId: data.serviceId,
      userId,
      date: dateUtc,
      time: timeUtc,
      status: 'CONFIRMED'
    });

    WebhookService.dispatch('appointment.created', data.businessId, appointment);

    // Enviar notificaciones a cliente y owner
    this.triggerAppointmentNotifications(appointment.id).catch(err =>
      console.error('Error enviando notificaciones de reserva:', err)
    );

    return appointment;
  }

  async cancelAppointment(
    id: number,
    userId: number,
    userRole: string,
    data: { reason: string; cancelledByUserId?: string }
  ) {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new AppError('Turno no encontrado', 404);
    }

    // 1. Validar estado actual del turno
    if (appointment.status === 'CANCELLED') {
      throw new AppError('El turno ya se encuentra cancelado', 400);
    }

    if (appointment.status === 'COMPLETED') {
      throw new AppError('No es posible cancelar un turno que ya ha sido completado', 400);
    }

    // 2. Validar autorización del solicitante
    const isClient = appointment.userId === userId;
    const isOwner = appointment.business?.ownerId === userId;
    const isAdmin = userRole === 'administrator';

    if (!isClient && !isOwner && !isAdmin) {
      throw new AppError('No tienes permiso para cancelar este turno', 403);
    }

    // 3. Regla de negocio: Validación estricta de 24 horas de anticipación
    const hoursUntil = getHoursUntilAppointment(appointment.date, appointment.time);

    if (hoursUntil <= 0) {
      throw new AppError('No se puede cancelar un turno cuya fecha u horario ya ha transcurrido', 400);
    }

    const minCancellationHours = appointment.service?.minCancellationNoticeHours ?? 24;

    if (hoursUntil < minCancellationHours && !isAdmin && !isOwner) {
      throw new AppError(
        `Solo se pueden cancelar turnos con al menos ${minCancellationHours} horas de anticipación al horario pactado`,
        400
      );
    }

    const cancelled = await this.appointmentRepo.cancelAppointment(id, {
      cancelledReason: data.reason,
      cancelledByUserId: data.cancelledByUserId || userId.toString()
    });

    WebhookService.dispatch('appointment.cancelled', appointment.businessId, cancelled);

    // Enviar notificaciones de cancelación
    this.triggerCancellationNotifications(appointment, userId, data.reason).catch(err =>
      console.error('Error enviando notificaciones de cancelación:', err)
    );

    return cancelled;
  }

  private async triggerAppointmentNotifications(appointmentId: number) {
    if (!this.notificationService) return;
    try {
      const full = await this.appointmentRepo.findById(appointmentId);
      if (!full) return;

      const timeFormatted = formatTimeHelper(full.time);
      const dateFormatted = formatDateHelper(full.date);
      const serviceName = full.service?.name || 'Servicio';
      const businessName = full.business?.name || 'Negocio';
      const clientName = full.user?.name || 'Cliente';

      // 1. Notificación al Cliente: confirmación de reserva exitosa
      await this.notificationService.createNotification({
        userId: full.userId,
        title: '¡Turno guardado con éxito!',
        message: `Tu turno para "${serviceName}" en ${businessName} el ${dateFormatted} a las ${timeFormatted} hs se guardó exitosamente.`,
        type: 'APPOINTMENT_CONFIRMED'
      });

      // 2. Notificación al Owner: aviso de nuevo turno agendado
      if (full.business?.ownerId) {
        await this.notificationService.createNotification({
          userId: full.business.ownerId,
          title: 'Nuevo turno reservado',
          message: `${clientName} ha reservado un turno para "${serviceName}" el ${dateFormatted} a las ${timeFormatted} hs.`,
          type: 'NEW_BOOKING'
        });
      }
    } catch (err) {
      console.error('triggerAppointmentNotifications error:', err);
    }
  }

  private async triggerCancellationNotifications(appointment: any, cancelledByUserId: number, reason?: string) {
    if (!this.notificationService) return;
    try {
      const timeFormatted = formatTimeHelper(appointment.time);
      const dateFormatted = formatDateHelper(appointment.date);
      const serviceName = appointment.service?.name || 'Servicio';
      const businessName = appointment.business?.name || 'Negocio';
      const clientName = appointment.user?.name || 'Cliente';
      const reasonText = reason ? ` Motivo: ${reason}` : '';

      // 1. Notificación al Owner: aviso de cancelación
      if (appointment.business?.ownerId) {
        await this.notificationService.createNotification({
          userId: appointment.business.ownerId,
          title: 'Turno cancelado',
          message: `El turno de ${clientName} para "${serviceName}" el ${dateFormatted} a las ${timeFormatted} hs fue cancelado.${reasonText}`,
          type: 'APPOINTMENT_CANCELLED'
        });
      }

      // 2. Si el turno fue cancelado por el Owner o Administrador, notificar al Cliente
      if (cancelledByUserId !== appointment.userId) {
        await this.notificationService.createNotification({
          userId: appointment.userId,
          title: 'Tu turno ha sido cancelado',
          message: `Tu turno para "${serviceName}" en ${businessName} el ${dateFormatted} a las ${timeFormatted} hs fue cancelado.${reasonText}`,
          type: 'APPOINTMENT_CANCELLED'
        });
      }
    } catch (err) {
      console.error('triggerCancellationNotifications error:', err);
    }
  }

  async updateStatus(
    id: number,
    userId: number,
    userRole: string,
    status: AppointmentStatus
  ) {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new AppError('Turno no encontrado', 404);
    }

    const isOwner = appointment.business?.ownerId === userId;
    const isAdmin = userRole === 'administrator';

    if (!isOwner && !isAdmin) {
      throw new AppError('Solo el dueño del comercio o administrador puede modificar el estado del turno', 403);
    }

    if (appointment.status === 'CANCELLED' && status === 'COMPLETED') {
      throw new AppError('No se puede completar un turno que ya fue cancelado', 400);
    }

    const updated = await this.appointmentRepo.updateStatus(id, status);

    if (status === 'COMPLETED') {
      WebhookService.dispatch('appointment.completed', appointment.businessId, updated);
    }

    return updated;
  }

  async getAppointments(params: GetAppointmentsParams) {
    const pagination = getPaginationOptions(params.page, params.limit, 100);

    const filterOptions: any = {
      skip: pagination.skip,
      take: pagination.limit
    };

    if (params.businessId) {
      filterOptions.businessId = params.businessId;
      if (params.date) {
        filterOptions.date = params.date;
      }
    } else {
      filterOptions.userId = params.userId;
    }

    const [appointments, total] = await this.appointmentRepo.findAppointments(filterOptions);
    return createPaginatedResponse(appointments, total, pagination.page, pagination.limit);
  }

  async getAppointmentById(id: number, userId: number, userRole: string) {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new AppError('Turno no encontrado', 404);
    }

    const isClient = appointment.userId === userId;
    const isOwner = appointment.business?.ownerId === userId;
    const isAdmin = userRole === 'administrator';

    if (!isClient && !isOwner && !isAdmin) {
      throw new AppError('No autorizado', 403);
    }

    return appointment;
  }

  async getBusySlots(businessId: number, date: string) {
    if (!date) {
      throw new AppError('El parámetro date es requerido (formato YYYY-MM-DD)', 400);
    }
    const busySlots = await this.appointmentRepo.findBusySlotsByDate(businessId, date);
    return { data: busySlots };
  }
}
