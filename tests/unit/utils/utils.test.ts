import {
  parseTimeToUTC,
  combineDateAndTime,
  getHoursUntilAppointment,
  isAppointmentPast,
  isPastGracePeriod,
} from '../../../src/utils/date';
import {
  getPaginationOptions,
  createPaginatedResponse,
} from '../../../src/utils/pagination';

describe('Utils (Unit Tests)', () => {
  describe('date utils', () => {
    it('parseTimeToUTC debe normalizar strings HH:mm a un objeto Date UTC con base 1970-01-01', () => {
      const parsed = parseTimeToUTC('16:30');
      expect(parsed.toISOString()).toBe('1970-01-01T16:30:00.000Z');
    });

    it('parseTimeToUTC debe normalizar timestamps ISO completos extrayendo la hora UTC', () => {
      const parsed = parseTimeToUTC('2026-10-15T18:45:00.000Z');
      expect(parsed.toISOString()).toBe('1970-01-01T18:45:00.000Z');
    });

    it('combineDateAndTime debe unificar correctamente fecha y hora', () => {
      const combined = combineDateAndTime('2026-12-25', '1970-01-01T14:30:00.000Z');
      expect(combined.getFullYear()).toBe(2026);
      expect(combined.getMonth()).toBe(11); // Diciembre = 11 (0-indexed)
      expect(combined.getDate()).toBe(25);
      expect(combined.getHours()).toBe(14);
      expect(combined.getMinutes()).toBe(30);
    });

    it('getHoursUntilAppointment debe retornar valor positivo para turnos a futuro y negativo para turnos pasados', () => {
      const future = new Date(Date.now() + 5 * 60 * 60 * 1000);
      const dateStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      const timeStr = `1970-01-01T${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}:00.000Z`;

      const hoursFuture = getHoursUntilAppointment(dateStr, timeStr);
      expect(hoursFuture).toBeGreaterThan(4);
      expect(hoursFuture).toBeLessThanOrEqual(6);

      const past = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const pastDateStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      const pastTimeStr = `1970-01-01T${String(past.getHours()).padStart(2, '0')}:${String(past.getMinutes()).padStart(2, '0')}:00.000Z`;

      const hoursPast = getHoursUntilAppointment(pastDateStr, pastTimeStr);
      expect(hoursPast).toBeLessThan(0);
    });

    it('isAppointmentPast debe identificar cuándo un turno ya finalizó considerando su duración', () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hora atrás
      const dateStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`;
      const timeStr = `1970-01-01T${String(pastDate.getHours()).padStart(2, '0')}:${String(pastDate.getMinutes()).padStart(2, '0')}:00.000Z`;

      expect(isAppointmentPast(dateStr, timeStr, 30)).toBe(true);
    });

    it('isPastGracePeriod debe validar si superó la tolerancia de 2 horas tras la finalización', () => {
      const finishedRecently = new Date(Date.now() - 30 * 60 * 1000); // 30 min atrás
      const dateStr = `${finishedRecently.getFullYear()}-${String(finishedRecently.getMonth() + 1).padStart(2, '0')}-${String(finishedRecently.getDate()).padStart(2, '0')}`;
      const timeStr = `1970-01-01T${String(finishedRecently.getHours()).padStart(2, '0')}:${String(finishedRecently.getMinutes()).padStart(2, '0')}:00.000Z`;

      // 30 min atrás + 30 min duración + 2 horas gracia = 2 horas restantes de gracia
      expect(isPastGracePeriod(dateStr, timeStr, 30, 2)).toBe(false);
    });
  });

  describe('pagination utils', () => {
    it('getPaginationOptions debe calcular skip y limitar al maxLimit', () => {
      const options = getPaginationOptions(3, 20, 50);
      expect(options).toEqual({
        page: 3,
        limit: 20,
        skip: 40,
      });

      // Clamping con valores extremos o negativos
      const clamped = getPaginationOptions(-1, 500, 100);
      expect(clamped).toEqual({
        page: 1,
        limit: 100,
        skip: 0,
      });
    });

    it('createPaginatedResponse debe estructurar la data y calcular totalPages correctamente', () => {
      const items = ['item1', 'item2'];
      const response = createPaginatedResponse(items, 25, 2, 10);

      expect(response).toEqual({
        data: items,
        meta: {
          total: 25,
          page: 2,
          limit: 10,
          totalPages: 3,
        },
      });
    });
  });
});
