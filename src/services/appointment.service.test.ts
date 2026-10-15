import { AppointmentService } from './appointment.service';
import { IAppointmentRepository } from '../interfaces/appointment.interface';
import { IServiceRepository } from '../interfaces/service.interface';
import { AppError } from '../middlewares/errorHandler';

describe('AppointmentService (Unit Tests)', () => {
  let appointmentService: AppointmentService;
  let mockAppointmentRepo: jest.Mocked<IAppointmentRepository>;
  let mockServiceRepo: jest.Mocked<IServiceRepository>;

  beforeEach(() => {
    mockAppointmentRepo = {
      createHold: jest.fn(),
      createDirect: jest.fn(),
      findById: jest.fn(),
      findByHoldToken: jest.fn(),
      confirmAppointment: jest.fn(),
      updateStatus: jest.fn(),
      cancelAppointment: jest.fn(),
      findAppointments: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      autoCompleteExpiredAppointments: jest.fn(),
      findBusySlotsByDate: jest.fn(),
      isSlotBusy: jest.fn(),
      clearPendingHolds: jest.fn(),
    } as unknown as jest.Mocked<IAppointmentRepository>;

    mockServiceRepo = {
      findById: jest.fn(),
      findByBusinessId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IServiceRepository>;

    appointmentService = new AppointmentService(
      mockAppointmentRepo,
      mockServiceRepo
    );
  });

  describe('holdAppointment', () => {
    it('debe crear un bloqueo temporal exitosamente para un horario futuro disponible', async () => {
      // Fecha futura: dentro de 5 días
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const dateStr = futureDate.toISOString().split('T')[0];
      const timeStr = '15:00';

      mockServiceRepo.findById.mockResolvedValue({
        id: 1,
        durationMinutes: 30,
      } as any);

      mockAppointmentRepo.isSlotBusy.mockResolvedValue(false);
      mockAppointmentRepo.clearPendingHolds.mockResolvedValue();
      mockAppointmentRepo.createHold.mockResolvedValue({ id: 10 } as any);

      const result = await appointmentService.holdAppointment(1, {
        businessId: 10,
        serviceId: 1,
        date: dateStr,
        time: timeStr,
      });

      expect(mockAppointmentRepo.isSlotBusy).toHaveBeenCalled();
      expect(mockAppointmentRepo.clearPendingHolds).toHaveBeenCalledWith(1);
      expect(mockAppointmentRepo.createHold).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 10,
          serviceId: 1,
          userId: 1,
        })
      );
      expect(result).toHaveProperty('holdToken');
      expect(result).toHaveProperty('expiresAt');
    });

    it('debe rechazar el bloqueo si la fecha y hora ya transcurrieron', async () => {
      // Fecha pasada
      const pastDate = '2020-01-01';
      const pastTime = '10:00';

      await expect(
        appointmentService.holdAppointment(1, {
          businessId: 10,
          serviceId: 1,
          date: pastDate,
          time: pastTime,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('ya ha transcurrido'),
      });

      expect(mockAppointmentRepo.createHold).not.toHaveBeenCalled();
    });

    it('debe rechazar el bloqueo si el turno ya fue ocupado por otro usuario', async () => {
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const dateStr = futureDate.toISOString().split('T')[0];
      const timeStr = '16:00';

      mockServiceRepo.findById.mockResolvedValue({
        id: 1,
        durationMinutes: 30,
      } as any);
      mockAppointmentRepo.isSlotBusy.mockResolvedValue(true);

      await expect(
        appointmentService.holdAppointment(2, {
          businessId: 10,
          serviceId: 1,
          date: dateStr,
          time: timeStr,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'El horario seleccionado ya no se encuentra disponible',
      });

      expect(mockAppointmentRepo.createHold).not.toHaveBeenCalled();
    });
  });

  describe('createAppointment', () => {
    it('debe confirmar una reserva existente cuando se provee un holdToken válido', async () => {
      const futureExpiry = new Date(Date.now() + 5 * 60 * 1000); // vence en 5 min
      const existingHold = {
        id: 50,
        holdToken: 'valid-hold-token',
        holdExpiresAt: futureExpiry,
        businessId: 10,
      };

      mockAppointmentRepo.findByHoldToken.mockResolvedValue(existingHold as any);
      mockAppointmentRepo.confirmAppointment.mockResolvedValue({
        id: 50,
        status: 'CONFIRMED',
      } as any);

      const confirmed = await appointmentService.createAppointment(1, {
        businessId: 10,
        serviceId: 1,
        date: '2026-12-01',
        time: '14:00',
        holdToken: 'valid-hold-token',
      });

      expect(mockAppointmentRepo.confirmAppointment).toHaveBeenCalledWith(50);
      expect(confirmed.status).toBe('CONFIRMED');
    });

    it('debe rechazar la reserva si el holdToken está vencido', async () => {
      const pastExpiry = new Date(Date.now() - 5 * 60 * 1000); // venció hace 5 min
      const expiredHold = {
        id: 40,
        holdToken: 'expired-hold-token',
        holdExpiresAt: pastExpiry,
      };

      mockAppointmentRepo.findByHoldToken.mockResolvedValue(expiredHold as any);

      await expect(
        appointmentService.createAppointment(1, {
          businessId: 10,
          serviceId: 1,
          date: '2026-12-01',
          time: '14:00',
          holdToken: 'expired-hold-token',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'El bloqueo temporal del turno ha expirado o es inválido',
      });

      expect(mockAppointmentRepo.confirmAppointment).not.toHaveBeenCalled();
    });

    it('debe rechazar la reserva si el holdToken no existe', async () => {
      mockAppointmentRepo.findByHoldToken.mockResolvedValue(null);

      await expect(
        appointmentService.createAppointment(1, {
          businessId: 10,
          serviceId: 1,
          date: '2026-12-01',
          time: '14:00',
          holdToken: 'token-inexistente',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'El bloqueo temporal del turno ha expirado o es inválido',
      });
    });
  });

  describe('cancelAppointment', () => {
    it('debe permitir la cancelación si se cumple con el tiempo de anticipación mínima', async () => {
      // Turno dentro de 48 horas con política de aviso de 24 horas
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const appointment = {
        id: 12,
        businessId: 10,
        userId: 3,
        status: 'CONFIRMED',
        date: futureDate.toISOString(),
        time: '1970-01-01T15:00:00.000Z',
        service: {
          minCancellationNoticeHours: 24,
        },
        business: {
          ownerId: 99,
        },
      };

      mockAppointmentRepo.findById.mockResolvedValue(appointment as any);
      mockAppointmentRepo.cancelAppointment.mockResolvedValue({
        ...appointment,
        status: 'CANCELLED',
      } as any);

      const result = await appointmentService.cancelAppointment(12, 3, 'client', {
        reason: 'Imprevisto personal',
      });

      expect(mockAppointmentRepo.cancelAppointment).toHaveBeenCalledWith(12, {
        cancelledReason: 'Imprevisto personal',
        cancelledByUserId: '3',
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('debe rechazar la cancelación por parte del cliente si no cumple con las horas de anticipación requeridas', async () => {
      // Turno dentro de 2 horas con política de 24 horas
      const nearFutureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const dateStr = `${nearFutureDate.getFullYear()}-${String(nearFutureDate.getMonth() + 1).padStart(2, '0')}-${String(nearFutureDate.getDate()).padStart(2, '0')}`;
      const timeStr = `1970-01-01T${String(nearFutureDate.getHours()).padStart(2, '0')}:${String(nearFutureDate.getMinutes()).padStart(2, '0')}:00.000Z`;

      const appointment = {
        id: 15,
        businessId: 10,
        userId: 3,
        status: 'CONFIRMED',
        date: dateStr,
        time: timeStr,
        service: {
          minCancellationNoticeHours: 24,
        },
        business: {
          ownerId: 99,
        },
      };

      mockAppointmentRepo.findById.mockResolvedValue(appointment as any);

      await expect(
        appointmentService.cancelAppointment(15, 3, 'client', {
          reason: 'Aviso de último momento',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Solo se pueden cancelar turnos con al menos 24 horas de anticipación'),
      });

      expect(mockAppointmentRepo.cancelAppointment).not.toHaveBeenCalled();
    });

    it('debe permitir al administrador cancelar el turno aunque no se cumpla la anticipación mínima', async () => {
      const nearFutureDate = new Date(Date.now() + 1 * 60 * 60 * 1000);
      const dateStr = `${nearFutureDate.getFullYear()}-${String(nearFutureDate.getMonth() + 1).padStart(2, '0')}-${String(nearFutureDate.getDate()).padStart(2, '0')}`;
      const timeStr = `1970-01-01T${String(nearFutureDate.getHours()).padStart(2, '0')}:${String(nearFutureDate.getMinutes()).padStart(2, '0')}:00.000Z`;

      const appointment = {
        id: 18,
        businessId: 10,
        userId: 3,
        status: 'CONFIRMED',
        date: dateStr,
        time: timeStr,
        service: {
          minCancellationNoticeHours: 24,
        },
        business: {
          ownerId: 99,
        },
      };

      mockAppointmentRepo.findById.mockResolvedValue(appointment as any);
      mockAppointmentRepo.cancelAppointment.mockResolvedValue({
        ...appointment,
        status: 'CANCELLED',
      } as any);

      const result = await appointmentService.cancelAppointment(18, 1, 'administrator', {
        reason: 'Cancelación administrativa de emergencia',
      });

      expect(mockAppointmentRepo.cancelAppointment).toHaveBeenCalled();
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('getAppointmentById', () => {
    it('debe retornar el turno si el usuario solicitante es el cliente que lo reservó', async () => {
      const appointment = {
        id: 20,
        userId: 7,
        business: { ownerId: 15 },
      };

      mockAppointmentRepo.findById.mockResolvedValue(appointment as any);

      const result = await appointmentService.getAppointmentById(20, 7, 'client');
      expect(result.id).toBe(20);
    });

    it('debe rechazar con 403 si un cliente intenta ver el turno de otro cliente', async () => {
      const appointment = {
        id: 25,
        userId: 7,
        business: { ownerId: 15 },
      };

      mockAppointmentRepo.findById.mockResolvedValue(appointment as any);

      await expect(
        appointmentService.getAppointmentById(25, 999, 'client')
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'No autorizado',
      });
    });

    it('debe lanzar 404 si el turno no existe', async () => {
      mockAppointmentRepo.findById.mockResolvedValue(null);

      await expect(
        appointmentService.getAppointmentById(999, 1, 'client')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Turno no encontrado',
      });
    });
  });
});
