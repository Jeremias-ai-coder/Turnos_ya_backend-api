import {
  holdAppointmentSchema,
  createAppointmentSchema,
  cancelAppointmentSchema,
} from '../../../src/validators/appointment.validator';
import {
  createBusinessSchema,
  updateBusinessSchema,
} from '../../../src/validators/business.validator';

describe('Zod Validators (Unit Tests)', () => {
  describe('appointment.validator', () => {
    it('holdAppointmentSchema debe validar correctamente una carga válida', () => {
      const validPayload = {
        businessId: 1,
        serviceId: 2,
        date: new Date('2026-11-20T10:00:00.000Z').toISOString(),
        time: '1970-01-01T15:00:00.000Z',
      };

      const result = holdAppointmentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('holdAppointmentSchema debe rechazar ids negativos o fechas inválidas', () => {
      const invalidPayload = {
        businessId: -5,
        serviceId: 0,
        date: 'no-es-una-fecha',
        time: '15:00',
      };

      const result = holdAppointmentSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('createAppointmentSchema debe aceptar un holdToken opcional', () => {
      const validPayloadWithToken = {
        businessId: 1,
        serviceId: 2,
        date: new Date('2026-11-20T10:00:00.000Z').toISOString(),
        time: '1970-01-01T15:00:00.000Z',
        holdToken: 'uuid-1234-abcd',
      };

      const result = createAppointmentSchema.safeParse(validPayloadWithToken);
      expect(result.success).toBe(true);
    });

    it('cancelAppointmentSchema debe requerir un motivo (reason) no vacío', () => {
      const emptyReason = { reason: '' };
      const validReason = { reason: 'Problemas de salud', cancelledByUserId: '5' };

      expect(cancelAppointmentSchema.safeParse(emptyReason).success).toBe(false);
      expect(cancelAppointmentSchema.safeParse(validReason).success).toBe(true);
    });
  });

  describe('business.validator', () => {
    it('createBusinessSchema debe validar un negocio con coordenadas y datos completos', () => {
      const validPayload = {
        name: 'Barbería Moderna',
        description: 'Cortes y peinados clásicos',
        address: 'Palermo Soho, CABA',
        latitude: -34.5885,
        longitude: -58.4285,
        logoUrl: 'https://example.com/logo.jpg',
      };

      const result = createBusinessSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('createBusinessSchema debe rechazar nombres de menos de 2 caracteres', () => {
      const invalidPayload = {
        name: 'A',
      };

      const result = createBusinessSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('createBusinessSchema debe rechazar URLs inválidas en logoUrl', () => {
      const invalidPayload = {
        name: 'Barbería',
        logoUrl: 'url-invalida',
      };

      const result = createBusinessSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('updateBusinessSchema debe permitir actualizaciones parciales', () => {
      const partialUpdate = {
        description: 'Nueva descripción actualizada',
      };

      const result = updateBusinessSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });
  });
});
