import { PrismaClient } from '@prisma/client';
import { CacheService, cacheService } from './cache.service';
import { AppError } from '../middlewares/errorHandler';
import { sendEmail } from './email.service';
import { NotificationService } from './notification.service';
import { getEmergencyCancellationEmailHtml } from '../utils/emailTemplates';

export interface AuditLogEntry {
  id: number;
  adminId: number;
  adminName: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
}

export class AuditService {
  private tableInitialized = false;

  constructor(
    private prisma: PrismaClient,
    private notificationService?: NotificationService,
    private cache: CacheService = cacheService
  ) {}

  private async ensureTable() {
    if (this.tableInitialized) return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          admin_id INT NOT NULL,
          admin_name VARCHAR(120) NOT NULL,
          action VARCHAR(100) NOT NULL,
          target_type VARCHAR(50) NOT NULL,
          target_id VARCHAR(100) NULL,
          details TEXT NULL,
          ip_address VARCHAR(60) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.tableInitialized = true;
    } catch (err) {
      console.warn('[AUDIT] Warning al verificar tabla audit_logs:', err);
    }
  }

  async recordLog(data: {
    adminId: number;
    adminName: string;
    action: string;
    targetType: string;
    targetId?: string | number | null;
    details?: string | null;
    ipAddress?: string | null;
  }) {
    await this.ensureTable();
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO audit_logs (admin_id, admin_name, action, target_type, target_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        data.adminId,
        data.adminName,
        data.action,
        data.targetType,
        data.targetId ? String(data.targetId) : null,
        data.details || null,
        data.ipAddress || null
      );
    } catch (err) {
      console.error('[AUDIT] Error registrando log de auditoría:', err);
    }
  }

  async getAuditLogs(page: number = 1, limit: number = 25, action?: string, search?: string) {
    await this.ensureTable();
    const offset = (page - 1) * limit;

    let whereSql = 'WHERE 1=1';
    const params: any[] = [];

    if (action && action !== 'ALL') {
      whereSql += ' AND action = ?';
      params.push(action);
    }

    if (search && search.trim()) {
      whereSql += ' AND (admin_name LIKE ? OR target_type LIKE ? OR details LIKE ? OR target_id LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    try {
      const countRows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as total FROM audit_logs ${whereSql}`,
        ...params
      );
      const total = Number(countRows[0]?.total || 0);

      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, admin_id as adminId, admin_name as adminName, action, target_type as targetType, target_id as targetId, details, ip_address as ipAddress, created_at as createdAt
         FROM audit_logs
         ${whereSql}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
        ...params,
        limit,
        offset
      );

      return {
        data: rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1
        }
      };
    } catch (err) {
      console.error('[AUDIT] Error consultando logs de auditoría:', err);
      return {
        data: [],
        meta: { total: 0, page: 1, limit, totalPages: 1 }
      };
    }
  }

  async emergencyCancelBusinessAppointments(params: {
    businessId: number;
    date: string;
    reason: string;
    adminId: number;
    adminName: string;
    ipAddress?: string;
  }) {
    const { businessId, date, reason, adminId, adminName, ipAddress } = params;

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { owner: true }
    });

    if (!business) {
      throw new AppError('Comercio no encontrado', 404);
    }

    const dateUtc = new Date(date.includes('T') ? date : `${date}T00:00:00.000Z`);

    // Buscar todos los turnos activos en esa fecha para ese comercio
    const appointmentsToCancel = await this.prisma.appointment.findMany({
      where: {
        businessId,
        date: dateUtc,
        status: {
          in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
        }
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        service: { select: { id: true, name: true } }
      }
    });

    if (appointmentsToCancel.length === 0) {
      return {
        message: 'No se encontraron turnos activos para cancelar en la fecha seleccionada.',
        cancelledCount: 0,
        appointments: []
      };
    }

    // Cancelar en lote
    const appointmentIds = appointmentsToCancel.map(a => a.id);
    await this.prisma.appointment.updateMany({
      where: { id: { in: appointmentIds } },
      data: {
        status: 'CANCELLED',
        cancelledReason: `[Fuerza Mayor - Admin] ${reason}`,
        cancelledByUserId: `ADMIN_${adminId}`
      }
    });

    const dateFormatted = dateUtc.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });

    // Notificar a cada cliente afectado
    for (const apt of appointmentsToCancel) {
      try {
        if (this.notificationService) {
          await this.notificationService.createNotification({
            userId: apt.user.id,
            type: 'APPOINTMENT_EMERGENCY_CANCELLED',
            title: `Turno cancelado por fuerza mayor en ${business.name}`,
            message: `Lamentamos informarte que tu turno de ${apt.service.name} para el ${dateFormatted} ha sido cancelado de emergencia. Motivo: ${reason}. Por favor contáctate con el local para reprogramar.`
          });
        }

        if (apt.user.email) {
          const frontendUrl = process.env.FRONTEND_URL || 'https://turnos-ya-frontend-web-delta.vercel.app';
          sendEmail({
            to: apt.user.email,
            subject: `Aviso urgente: Turno cancelado por fuerza mayor en ${business.name}`,
            html: getEmergencyCancellationEmailHtml({
              clientName: apt.user.name,
              businessName: business.name,
              serviceName: apt.service.name,
              dateFormatted,
              reason,
              frontendUrl,
            }),
          }).catch(err => console.warn('[EMAIL] Error enviando correo de cancelación de emergencia:', err));
        }
      } catch (err) {
        console.warn(`[EMERGENCY_CANCEL] Error notificando al usuario ${apt.user.id}:`, err);
      }
    }

    // Notificar al dueño del comercio
    if (business.ownerId && this.notificationService) {
      await this.notificationService.createNotification({
        userId: business.ownerId,
        type: 'BUSINESS_EMERGENCY_CANCELLED',
        title: `Cancelación masiva por fuerza mayor aplicada`,
        message: `La administración ejecutó una cancelación masiva de ${appointmentsToCancel.length} turno(s) para el ${dateFormatted}. Motivo: ${reason}.`
      });
    }

    // Registrar en Auditoría
    await this.recordLog({
      adminId,
      adminName,
      action: 'EMERGENCY_CANCEL',
      targetType: 'business',
      targetId: businessId,
      details: `Cancelados ${appointmentsToCancel.length} turnos para el ${dateFormatted}. Motivo: ${reason}`,
      ipAddress
    });

    // Invalidar cachés
    await Promise.all([
      this.cache.delPattern(`slots:${businessId}:*`),
      this.cache.delPattern('appointments:*'),
      this.cache.del('admin:stats')
    ]);

    return {
      message: `Se cancelaron exitosamente ${appointmentsToCancel.length} turnos por fuerza mayor y se notificó a los clientes.`,
      cancelledCount: appointmentsToCancel.length,
      appointments: appointmentsToCancel
    };
  }
}
