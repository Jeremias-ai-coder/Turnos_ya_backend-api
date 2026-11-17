import crypto from 'crypto';
import { AppointmentStatus } from '@prisma/client';
import { IAppointmentRepository } from '../interfaces/appointment.interface';
import { IServiceRepository } from '../interfaces/service.interface';
import { IBusinessRepository } from '../interfaces/business.interface';
import { NotificationService } from './notification.service';
import { AppError } from '../middlewares/errorHandler';
import { getPaginationOptions, createPaginatedResponse } from '../utils/pagination';
import {
  getHoursUntilAppointment,
  combineDateAndTime,
  parseTimeToUTC,
  formatDateHelper,
  formatTimeHelper,
} from '../utils/date';

export interface GetAppointmentsParams {
  userId: number;
  userRole: string;
  page?: number;
  limit?: number;
  businessId?: number;
  date?: string;
}

import { CacheService, cacheService } from './cache.service';
import { CommunityService } from './community.service';

// =========================================================================================
// SERVICIO DE GESTIÓN DE TURNOS (AppointmentService)
// Capa: Dominio / Lógica de Negocio (Clean Architecture)
// Responsabilidades:
//  1. Orquestar el flujo de reserva transaccional en 2 fases: Hold (Bloqueo) y Confirmación.
//  2. Validar reglas temporales (fechas futuras, días hábiles, feriados del comercio).
//  3. Prevenir condiciones de carrera y sobreventa (Overbooking) mediante Hold Tokens (TTL 10m).
//  4. Aplicar política estricta de cancelación (anticipación mínima de 24 horas).
//  5. Disparar efectos colaterales desacoplados: Notificaciones In-App, SSE y Emails con Resend API.
// =========================================================================================

export class AppointmentService {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private serviceRepo?: IServiceRepository,
    private notificationService?: NotificationService,
    private cache: CacheService = cacheService,
    private businessRepo?: IBusinessRepository,
    private communityService?: CommunityService
  ) {}

  // ---------------------------------------------------------------------------------------
  // FASE 1: BLOQUEO TEMPORAL DEL TURNO (HOLD TOKEN)
  // Endpoint: POST /api/v1/appointments/hold
  // Propósito: Bloquea un slot por 10 minutos para dar tiempo al usuario a confirmar sin que
  //            otro cliente reserve el mismo espacio.
  // ---------------------------------------------------------------------------------------
  async holdAppointment(userId: number, data: { businessId: number; serviceId: number; date: string; time: string }) {
    // 1.1 Validación temporal: La cita debe ser estrictamente futura
    const appointmentStart = combineDateAndTime(data.date, data.time);
    if (appointmentStart <= new Date()) {
      throw new AppError('No es posible reservar un turno en una fecha u horario que ya ha transcurrido', 400);
    }

    // 1.2 Validación de estado del comercio: Solo comercios aprobados pueden operar
    if (this.businessRepo) {
      const business = await this.businessRepo.findById(Number(data.businessId));
      if (!business) {
        throw new AppError('Negocio no encontrado', 404);
      }
      if (business.status && business.status !== 'approved') {
        throw new AppError('Este comercio no se encuentra habilitado para recibir reservas en este momento', 400);
      }
    }

    // 1.3 Validación de días cerrados / feriados configurados por el dueño
    if (this.communityService) {
      const closedReason = await this.communityService.getClosedReasonForDate(Number(data.businessId), data.date);
      if (closedReason) {
        throw new AppError(`El comercio permanece cerrado en la fecha seleccionada (${closedReason})`, 400);
      }
    }

    // 1.4 Estandarización de fecha y hora a medianoche UTC para evitar Timezone Drift
    const dateUtc = new Date(data.date.includes('T') ? data.date : `${data.date}T00:00:00.000Z`);
    const timeUtc = parseTimeToUTC(data.time);

    // 1.5 Obtención de duración real del servicio (discretización de tiempo)
    let durationMinutes = 30;
    if (this.serviceRepo) {
      const service = await this.serviceRepo.findById(data.serviceId);
      if (!service) {
        throw new AppError('Servicio no encontrado', 404);
      }
      if (service.businessId !== undefined && Number(service.businessId) !== Number(data.businessId)) {
        throw new AppError('El servicio seleccionado no pertenece a este comercio', 400);
      }
      durationMinutes = service.durationMinutes;
    }

    // 1.6 ALGORITMO DE DETECCIÓN DE COLISIONES: Evalúa solapamiento de intervalos semiabiertos [start, end)
    const isBusy = await this.appointmentRepo.isSlotBusy(data.businessId, dateUtc, timeUtc, durationMinutes, userId);
    if (isBusy) {
      throw new AppError('El horario seleccionado ya no se encuentra disponible', 400);
    }

    // 1.7 REGLA ANTI-ACAPARAMIENTO: Limpia bloqueos temporales previos no completados del mismo usuario
    await this.appointmentRepo.clearPendingHolds(userId);

    // 1.8 Generación de Token Criptográfico UUID y TTL de 10 minutos
    const holdToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos TTL

    // 1.9 Persistencia del bloqueo pesimista en base de datos (status: 'PENDING')
    await this.appointmentRepo.createHold({
      businessId: data.businessId,
      serviceId: data.serviceId,
      userId,
      date: dateUtc,
      time: timeUtc,
      holdToken,
      holdExpiresAt: expiresAt
    });

    // 1.10 Invalidación selectiva de la caché de disponibilidad horaria del negocio
    this.cache.delPattern(`slots:${data.businessId}:*`).catch(() => {});

    return {
      holdToken,
      expiresAt: expiresAt.toISOString()
    };
  }

  // ---------------------------------------------------------------------------------------
  // FASE 2: CONFIRMACIÓN DEFINITIVA DEL TURNO
  // Endpoint: POST /api/v1/appointments
  // Propósito: Convierte un Hold tentativo en turno confirmado (o crea uno directo si no hay hold).
  // ---------------------------------------------------------------------------------------
  async createAppointment(userId: number, data: { businessId: number; serviceId: number; date: string; time: string; holdToken?: string }) {
    if (this.businessRepo) {
      const business = await this.businessRepo.findById(Number(data.businessId));
      if (!business) {
        throw new AppError('Negocio no encontrado', 404);
      }
      if (business.status && business.status !== 'approved') {
        throw new AppError('Este comercio no se encuentra habilitado para recibir reservas en este momento', 400);
      }
    }

    // CASO A: Confirmación a partir de un Hold Token previo (Flujo estándar en 2 fases)
    if (data.holdToken) {
      const existingHold = await this.appointmentRepo.findByHoldToken(data.holdToken);

      // 2.A.1 Valida existencia y vigencia temporal del bloqueo
      if (!existingHold || (existingHold.holdExpiresAt && existingHold.holdExpiresAt < new Date())) {
        throw new AppError('El bloqueo temporal del turno ha expirado o es inválido', 400);
      }

      // 2.A.2 SEGURIDAD ANTI-SECUESTRO: El token solo puede ser confirmado por el usuario que lo reservó
      if (existingHold.userId !== undefined && existingHold.userId !== userId) {
        throw new AppError('El bloqueo temporal pertenece a otro usuario', 403);
      }

      // 2.A.3 Consistencia de datos: Coincidencia de comercio y servicio
      if (
        (existingHold.businessId !== undefined && Number(existingHold.businessId) !== Number(data.businessId)) ||
        (existingHold.serviceId !== undefined && Number(existingHold.serviceId) !== Number(data.serviceId))
      ) {
        throw new AppError('El bloqueo temporal no coincide con el comercio o servicio seleccionado', 400);
      }

      // 2.A.4 Transición de estado atómica: PENDING -> CONFIRMED (Limpia holdToken y holdExpiresAt)
      const confirmed = await this.appointmentRepo.confirmAppointment(existingHold.id);

      // 2.A.5 Notificaciones y Despacho en Vivo (In-App, SSE para agenda del dueño y Email con Resend API)
      await this.triggerAppointmentNotifications(confirmed.id).catch(err =>
        console.error('Error enviando notificaciones de reserva:', err)
      );

      // 2.A.6 Invalidación de caché de slots y métricas ejecutivas de administración
      await Promise.all([
        this.cache.delPattern(`slots:${data.businessId}:*`),
        this.cache.del('admin:stats')
      ]);

      return confirmed;
    }

    // CASO B: Reserva directa (ej. turnos agendados manualmente por el dueño desde su panel)

    // Reserva directa sin hold
    if (this.communityService) {
      const closedReason = await this.communityService.getClosedReasonForDate(Number(data.businessId), data.date);
      if (closedReason !== null) {
        throw new AppError(`El comercio permanece cerrado en la fecha seleccionada (${closedReason})`, 400);
      }
    }

    const appointmentStart = combineDateAndTime(data.date, data.time);
    if (appointmentStart <= new Date()) {
      throw new AppError('No es posible reservar un turno en una fecha u horario que ya ha transcurrido', 400);
    }

    const dateUtc = new Date(data.date.includes('T') ? data.date : `${data.date}T00:00:00.000Z`);
    const timeUtc = parseTimeToUTC(data.time);

    let durationMinutes = 30;
    if (this.serviceRepo) {
      const service = await this.serviceRepo.findById(data.serviceId);
      if (!service) {
        throw new AppError('Servicio no encontrado', 404);
      }
      if (service.businessId !== undefined && Number(service.businessId) !== Number(data.businessId)) {
        throw new AppError('El servicio seleccionado no pertenece a este comercio', 400);
      }
      durationMinutes = service.durationMinutes;
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

    // Enviar notificaciones a cliente y owner de forma síncrona para disponibilidad inmediata
    await this.triggerAppointmentNotifications(appointment.id).catch(err =>
      console.error('Error enviando notificaciones de reserva:', err)
    );

    // Invalidar slots cacheados y estadísticas de admin
    await Promise.all([
      this.cache.delPattern(`slots:${data.businessId}:*`),
      this.cache.del('admin:stats')
    ]);

    return appointment;
  }

  // ---------------------------------------------------------------------------------------
  // CANCELACIÓN DE TURNO
  // Endpoint: PATCH /api/v1/appointments/:id/cancel
  // Propósito: Aplica la política de cancelación anticipada (24 horas) y gestiona permisos.
  // ---------------------------------------------------------------------------------------
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

    // 1. Validar máquina de estados: No se pueden cancelar turnos ya finalizados o previamente cancelados
    if (appointment.status === 'CANCELLED') {
      throw new AppError('El turno ya se encuentra cancelado', 400);
    }

    if (appointment.status === 'COMPLETED') {
      throw new AppError('No es posible cancelar un turno que ya ha sido completado', 400);
    }

    // 2. Control de Autorización RBAC: Solo el cliente dueño del turno, el dueño del local o un admin pueden cancelar
    const isClient = appointment.userId === userId;
    const isOwner = appointment.business?.ownerId === userId;
    const isAdmin = userRole === 'administrator';

    if (!isClient && !isOwner && !isAdmin) {
      throw new AppError('No tienes permiso para cancelar este turno', 403);
    }

    // 3. Regla de Negocio: Validación estricta de anticipación (24 horas)
    const hoursUntil = getHoursUntilAppointment(appointment.date, appointment.time);

    if (hoursUntil <= 0) {
      throw new AppError('No se puede cancelar un turno cuya fecha u horario ya ha transcurrido', 400);
    }

    const minCancellationHours = Math.max(24, appointment.service?.minCancellationNoticeHours || 24);

    // EXCEPCIÓN DE NEGOCIO: Los clientes deben cumplir las 24hs obligatorias.
    // Los dueños de comercio y administradores quedan exentos por casos de fuerza mayor o emergencias.
    const isExempt = isOwner || (isAdmin && !isClient);

    if (hoursUntil < minCancellationHours && !isExempt) {
      throw new AppError(
        `Solo se pueden cancelar turnos con al menos ${minCancellationHours} horas de anticipación al horario pactado`,
        400
      );
    }

    const cancelled = await this.appointmentRepo.cancelAppointment(id, {
      cancelledReason: data.reason,
      cancelledByUserId: String(userId)
    });

    // Invalidar slots cacheados y estadísticas de admin
    await Promise.all([
      this.cache.delPattern(`slots:${appointment.businessId}:*`),
      this.cache.del('admin:stats')
    ]);

    // Enviar notificaciones de cancelación de forma síncrona
    await this.triggerCancellationNotifications(appointment, userId, data.reason).catch(err =>
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

      // 1. Notificación al Owner: aviso de cancelación en su agenda
      if (appointment.business?.ownerId) {
        await this.notificationService.createNotification({
          userId: appointment.business.ownerId,
          title: 'Turno cancelado',
          message: `El turno de ${clientName} para "${serviceName}" en "${businessName}" el ${dateFormatted} a las ${timeFormatted} hs fue cancelado.${reasonText}`,
          type: 'BOOKING_CANCELLED'
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

    // Notificaciones en tiempo real según el nuevo estado del turno
    if (status === 'CONFIRMED' && this.notificationService) {
      const serviceName = appointment.service?.name || 'Servicio';
      const businessName = appointment.business?.name || 'el negocio';
      const dateFormatted = formatDateHelper(appointment.date);
      const timeFormatted = formatTimeHelper(appointment.time);

      await this.notificationService.createNotification({
        userId: appointment.userId,
        title: '¡Turno confirmado!',
        message: `Tu turno para "${serviceName}" en ${businessName} el ${dateFormatted} a las ${timeFormatted} hs fue confirmado.`,
        type: 'APPOINTMENT_CONFIRMED'
      }).catch(err => console.error('[APPOINTMENT] Error al notificar confirmación:', err));
    } else if (status === 'COMPLETED' && this.notificationService) {
      const serviceName = appointment.service?.name || 'Servicio';
      const businessName = appointment.business?.name || 'el negocio';

      await this.notificationService.createNotification({
        userId: appointment.userId,
        title: 'Turno completado',
        message: `Tu turno para "${serviceName}" en ${businessName} ha sido marcado como completado. ¡Gracias por tu visita! Podés dejar tu calificación en Mis Turnos.`,
        type: 'APPOINTMENT_COMPLETED'
      }).catch(err => console.error('[APPOINTMENT] Error al notificar completado:', err));
    } else if (status === 'CANCELLED') {
      await this.triggerCancellationNotifications(appointment, userId).catch(err => console.error('[APPOINTMENT] Error al notificar cancelación:', err));
    }

    // Invalidar slots cacheados y estadísticas de admin
    await Promise.all([
      this.cache.delPattern(`slots:${appointment.businessId}:*`),
      this.cache.del('admin:stats')
    ]);

    return updated;
  }

  async getAppointments(params: GetAppointmentsParams) {
    const pagination = getPaginationOptions(params.page, params.limit, 100);

    const filterOptions: any = {
      skip: pagination.skip,
      take: pagination.limit
    };

    if (params.businessId) {
      if (this.businessRepo && params.userRole !== 'administrator') {
        const business = await this.businessRepo.findById(Number(params.businessId));
        if (!business) {
          throw new AppError('Negocio no encontrado', 404);
        }
        if (business.ownerId !== params.userId) {
          throw new AppError('No tienes permiso para ver la agenda privada de este comercio', 403);
        }
      }
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
    return this.cache.getOrSet(
      `slots:${businessId}:${date}`,
      async () => {
        if (this.communityService) {
          const closedReason = await this.communityService.getClosedReasonForDate(businessId, date);
          if (closedReason) {
            return { data: [], isClosedDate: true, closedReason };
          }
        }
        const busySlots = await this.appointmentRepo.findBusySlotsByDate(businessId, date);
        return { data: busySlots, isClosedDate: false, closedReason: null };
      },
      180 // 3 minutos TTL
    );
  }
}
