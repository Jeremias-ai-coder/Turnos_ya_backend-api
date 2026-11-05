import { BusinessStatus } from '@prisma/client';
import { IBusinessRepository, CreateBusinessDTO, UpdateBusinessDTO } from '../interfaces/business.interface';
import { IUserRepository } from '../interfaces/user.interface';
import { NotificationService } from './notification.service';
import { AppError } from '../middlewares/errorHandler';
import { getPaginationOptions, createPaginatedResponse } from '../utils/pagination';
import { CacheService, cacheService } from './cache.service';
import { sendEmail } from './email.service';

export class BusinessService {
  constructor(
    private businessRepo: IBusinessRepository,
    private userRepo: IUserRepository,
    private notificationService?: NotificationService,
    private cache: CacheService = cacheService
  ) {}

  async getBusinesses(page: number = 1, limit: number = 10, search?: string, status: BusinessStatus | 'ALL' = 'approved') {
    const cleanSearch = search ? search.trim().toLowerCase() : 'all';
    const cacheKey = `businesses:list:${status}:${page}:${limit}:${cleanSearch}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const pagination = getPaginationOptions(page, limit, 200);
        const [businesses, total] = await this.businessRepo.findAll(pagination.skip, pagination.limit, search, status);
        return createPaginatedResponse(businesses, total, pagination.page, pagination.limit);
      },
      120 // 2 minutos TTL
    );
  }

  async getBusinessById(id: number) {
    return this.cache.getOrSet(
      `business:detail:${id}`,
      async () => {
        const business = await this.businessRepo.findById(id);
        if (!business) {
          throw new AppError('Negocio no encontrado', 404);
        }
        return business;
      },
      300 // 5 minutos TTL
    );
  }

  async createBusiness(userId: number, data: CreateBusinessDTO) {
    const business = await this.businessRepo.create(userId, data);
    const applicant = await this.userRepo.findById(userId);

    // Notificar a todos los administradores del sistema
    try {
      const allUsers = await this.userRepo.findAll();
      const admins = allUsers.filter(u => u.role === 'administrator');

      for (const admin of admins) {
        if (this.notificationService) {
          await this.notificationService.createNotification({
            userId: admin.id,
            type: 'BUSINESS_REGISTRATION_SUBMITTED',
            title: 'Nueva solicitud de negocio',
            message: `El usuario ${applicant?.name || 'Comerciante'} ha solicitado el alta de "${business.name}". Podés revisar las evidencias y confirmar el alta desde el panel de Sistema.`
          });
        }
      }

      // Notificar al solicitante
      if (this.notificationService) {
        await this.notificationService.createNotification({
          userId,
          type: 'BUSINESS_SUBMITTED',
          title: 'Solicitud de negocio recibida',
          message: `Tu solicitud para dar de alta "${business.name}" fue recibida y está siendo analizada por el equipo de administración.`
        });
      }

      // Email al solicitante
      if (applicant?.email) {
        sendEmail({
          to: applicant.email,
          subject: `Solicitud de alta recibida: ${business.name} — Turnos Ya`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; border: 1px solid #e2e8f0; borderRadius: 12px;">
              <h2 style="color: #0284c7; margin-top: 0;">¡Recibimos tu solicitud de alta!</h2>
              <p>Hola <strong>${applicant.name}</strong>,</p>
              <p>Tu solicitud para registrar el comercio <strong>${business.name}</strong> en Turnos Ya ha sido recibida correctamente.</p>
              <p style="background: #f8fafc; padding: 16px; border-left: 4px solid #0284c7; border-radius: 6px;">
                <strong>Estado:</strong> En revisión por administración<br/>
                <strong>Tiempo estimado:</strong> 12 a 24 horas hábiles.
              </p>
              <p>Revisaremos las evidencias y datos proporcionados para garantizar la veracidad de la información y te notificaremos apenas esté aprobado.</p>
              <p style="font-size: 0.88rem; color: #64748b; margin-top: 24px;">Equipo de Verificación de Turnos Ya</p>
            </div>
          `
        }).catch(err => console.warn('[EMAIL] Error enviando correo de confirmación de solicitud:', err));
      }
    } catch (err) {
      console.warn('[BUSINESS_SERVICE] Error emitiendo notificaciones de nueva solicitud:', err);
    }

    // Invalidar listados y métricas
    await Promise.all([
      this.cache.delPattern('businesses:list:*'),
      this.cache.del('admin:stats')
    ]);

    return business;
  }

  async getMyBusinesses(userId: number) {
    const businesses = await this.businessRepo.findByOwnerId(userId);
    return {
      data: businesses,
      meta: { total: businesses.length }
    };
  }

  async updateBusiness(id: number, userId: number, userRole: string, data: UpdateBusinessDTO) {
    const business = await this.businessRepo.findById(id);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    if (business.ownerId !== userId && userRole !== 'administrator') {
      throw new AppError('No autorizado', 403);
    }

    // Si el negocio estaba rechazado y el dueño lo edita para corregirlo, se reenvía a revisión
    if (business.status === 'rejected' && userRole !== 'administrator') {
      data.status = 'pending_approval';
      data.rejectionReason = null;

      // Notificar administradores de la corrección
      try {
        const allUsers = await this.userRepo.findAll();
        const admins = allUsers.filter(u => u.role === 'administrator');
        for (const admin of admins) {
          if (this.notificationService) {
            await this.notificationService.createNotification({
              userId: admin.id,
              type: 'BUSINESS_REGISTRATION_RESUBMITTED',
              title: 'Solicitud de negocio corregida',
              message: `El usuario ha corregido y reenviado la solicitud de "${business.name}" para una nueva revisión.`
            });
          }
        }
      } catch (err) {
        console.warn('[BUSINESS_SERVICE] Error notificando reenvío de solicitud:', err);
      }
    }

    const updated = await this.businessRepo.update(id, data);

    // Invalidar de forma inmediata el detalle y los listados cacheados
    await Promise.all([
      this.cache.del(`business:detail:${id}`),
      this.cache.delPattern('businesses:list:*'),
      this.cache.del('admin:stats')
    ]);

    return updated;
  }

  async approveBusiness(id: number, adminId: number) {
    const business = await this.businessRepo.findById(id);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    const updated = await this.businessRepo.update(id, {
      status: 'approved',
      rejectionReason: null,
      reviewedAt: new Date(),
      reviewedById: adminId
    });

    // Promover al usuario a 'owner' si era 'client'
    const owner = await this.userRepo.findById(business.ownerId);
    if (owner && owner.role === 'client') {
      await this.userRepo.update(owner.id, { role: 'owner' });
    }

    // Notificación in-app al dueño
    try {
      if (this.notificationService) {
        await this.notificationService.createNotification({
          userId: business.ownerId,
          type: 'BUSINESS_APPROVED',
          title: '¡Tu negocio ha sido aprobado!',
          message: `¡Felicitaciones! Tu negocio "${business.name}" ha sido verificado y aprobado. Ya se encuentra visible para recibir reservas en Turnos Ya.`
        });
      }

      // Email al dueño
      if (owner?.email) {
        sendEmail({
          to: owner.email,
          subject: `¡Tu negocio "${business.name}" ha sido aprobado! — Turnos Ya`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 40px;">🎉</span>
                <h2 style="color: #10b981; margin: 8px 0;">¡Negocio Verificado y Aprobado!</h2>
              </div>
              <p>Hola <strong>${owner.name}</strong>,</p>
              <p>Nos alegra informarte que nuestro equipo de administración ha revisado las evidencias y aprobado el alta de tu comercio <strong>${business.name}</strong>.</p>
              <p style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; color: #166534;">
                ✓ Tu perfil público ya está disponible en el catálogo.<br/>
                ✓ Tus clientes ahora pueden encontrar tus servicios y agendar turnos.
              </p>
              <div style="text-align: center; margin-top: 24px;">
                <a href="https://turnosyapp.vercel.app/dashboard" style="display: inline-block; background: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Ir a mi Panel de Control
                </a>
              </div>
            </div>
          `
        }).catch(err => console.warn('[EMAIL] Error enviando correo de aprobación:', err));
      }
    } catch (err) {
      console.warn('[BUSINESS_SERVICE] Error emitiendo notificación de aprobación:', err);
    }

    // Invalidar cachés
    await Promise.all([
      this.cache.del(`business:detail:${id}`),
      this.cache.delPattern('businesses:list:*'),
      this.cache.del('admin:stats')
    ]);

    return updated;
  }

  async rejectBusiness(id: number, adminId: number, reason: string) {
    const business = await this.businessRepo.findById(id);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    const updated = await this.businessRepo.update(id, {
      status: 'rejected',
      rejectionReason: reason,
      reviewedAt: new Date(),
      reviewedById: adminId
    });

    const owner = await this.userRepo.findById(business.ownerId);

    // Notificación in-app al dueño con el motivo
    try {
      if (this.notificationService) {
        await this.notificationService.createNotification({
          userId: business.ownerId,
          type: 'BUSINESS_REJECTED',
          title: 'Solicitud de negocio observada',
          message: `Tu solicitud para dar de alta "${business.name}" requiere modificaciones: ${reason}. Podés corregirla y volver a enviarla desde tu panel.`
        });
      }

      // Email al dueño
      if (owner?.email) {
        sendEmail({
          to: owner.email,
          subject: `Observaciones sobre tu solicitud de negocio "${business.name}" — Turnos Ya`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #dc2626; margin-top: 0;">Observaciones sobre tu solicitud</h2>
              <p>Hola <strong>${owner.name}</strong>,</p>
              <p>El equipo de verificación revisó la solicitud de alta para <strong>${business.name}</strong> y encontró algunos puntos que requieren tu atención:</p>
              <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 6px; margin: 16px 0; color: #991b1b;">
                <strong>Motivo de la observación:</strong><br/>
                ${reason}
              </div>
              <p>Podés ingresar a tu panel de control para actualizar los datos o evidencias solicitadas y reenviar la solicitud a revisión.</p>
              <div style="text-align: center; margin-top: 24px;">
                <a href="https://turnosyapp.vercel.app/dashboard" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Corregir y Reenviar Solicitud
                </a>
              </div>
            </div>
          `
        }).catch(err => console.warn('[EMAIL] Error enviando correo de rechazo:', err));
      }
    } catch (err) {
      console.warn('[BUSINESS_SERVICE] Error emitiendo notificación de rechazo:', err);
    }

    // Invalidar cachés
    await Promise.all([
      this.cache.del(`business:detail:${id}`),
      this.cache.delPattern('businesses:list:*'),
      this.cache.del('admin:stats')
    ]);

    return updated;
  }
}
