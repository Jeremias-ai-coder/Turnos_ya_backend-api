import { BusinessStatus } from '@prisma/client';
import { IBusinessRepository, CreateBusinessDTO, UpdateBusinessDTO } from '../interfaces/business.interface';
import { IUserRepository } from '../interfaces/user.interface';
import { NotificationService } from './notification.service';
import { AppError } from '../middlewares/errorHandler';
import { getPaginationOptions, createPaginatedResponse } from '../utils/pagination';
import { CacheService, cacheService } from './cache.service';
import { sendEmail } from './email.service';
import { AuditService } from './audit.service';
import {
  getBusinessSubmittedEmailHtml,
  getBusinessApprovedEmailHtml,
  getBusinessObservedEmailHtml,
  getBusinessSuspendedEmailHtml,
  getBusinessReactivatedEmailHtml,
} from '../utils/emailTemplates';

export class BusinessService {
  constructor(
    private businessRepo: IBusinessRepository,
    private userRepo: IUserRepository,
    private notificationService?: NotificationService,
    private cache: CacheService = cacheService,
    private auditService?: AuditService
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
      const allUsers = (await this.userRepo.findAll()) || [];
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
        const frontendUrl = process.env.FRONTEND_URL || 'https://turnos-ya-frontend-web-delta.vercel.app';
        sendEmail({
          to: applicant.email,
          subject: `Solicitud de alta recibida: ${business.name} — Turnos Ya`,
          html: getBusinessSubmittedEmailHtml({
            applicantName: applicant.name,
            businessName: business.name,
            frontendUrl,
          }),
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

    // Blindaje: un dueño no administrador jamás puede auto-aprobarse ni reactivarse
    if (userRole !== 'administrator') {
      delete data.status;
      delete data.rejectionReason;
    }

    // Si el negocio estaba rechazado y el dueño lo edita para corregirlo, se reenvía a revisión
    if (business.status === 'rejected' && userRole !== 'administrator') {
      data.status = 'pending_approval';
      data.rejectionReason = null;

      // Notificar administradores de la corrección
      try {
        const allUsers = (await this.userRepo.findAll()) || [];
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
        const frontendUrl = process.env.FRONTEND_URL || 'https://turnos-ya-frontend-web-delta.vercel.app';
        sendEmail({
          to: owner.email,
          subject: `¡Tu negocio "${business.name}" ha sido aprobado! — Turnos Ya`,
          html: getBusinessApprovedEmailHtml({
            ownerName: owner.name,
            businessName: business.name,
            frontendUrl,
          }),
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

    if (this.auditService) {
      const admin = await this.userRepo.findById(adminId);
      await this.auditService.recordLog({
        adminId,
        adminName: admin?.name || `Admin #${adminId}`,
        action: 'BUSINESS_APPROVED',
        targetType: 'Business',
        targetId: id,
        details: `Comercio "${business.name}" aprobado y dado de alta. Dueño: ${owner?.name || 'Desconocido'} (${owner?.email || 'sin email'}).`
      });
    }

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
        const frontendUrl = process.env.FRONTEND_URL || 'https://turnos-ya-frontend-web-delta.vercel.app';
        sendEmail({
          to: owner.email,
          subject: `Observaciones sobre tu solicitud de negocio "${business.name}" — Turnos Ya`,
          html: getBusinessObservedEmailHtml({
            ownerName: owner.name,
            businessName: business.name,
            reason,
            frontendUrl,
          }),
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

    if (this.auditService) {
      const admin = await this.userRepo.findById(adminId);
      await this.auditService.recordLog({
        adminId,
        adminName: admin?.name || `Admin #${adminId}`,
        action: 'BUSINESS_REJECTED',
        targetType: 'Business',
        targetId: id,
        details: `Comercio "${business.name}" observado. Motivo: ${reason}`
      });
    }

    return updated;
  }

  async suspendBusiness(id: number, adminId: number, reason: string) {
    const business = await this.businessRepo.findById(id);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    const updated = await this.businessRepo.update(id, {
      status: 'suspended',
      rejectionReason: reason,
      reviewedAt: new Date(),
      reviewedById: adminId
    });

    const owner = await this.userRepo.findById(business.ownerId);

    // Notificación in-app al dueño con el motivo de suspensión
    try {
      if (this.notificationService) {
        await this.notificationService.createNotification({
          userId: business.ownerId,
          type: 'BUSINESS_SUSPENDED',
          title: 'Comercio suspendido temporalmente',
          message: `Tu comercio "${business.name}" ha sido suspendido por la administración de Turnos Ya: ${reason}. Durante la suspensión no estará visible en el catálogo ni aceptará reservas.`
        });
      }

      // Email al dueño
      if (owner?.email) {
        sendEmail({
          to: owner.email,
          subject: `Aviso importante: Comercio "${business.name}" suspendido — Turnos Ya`,
          html: getBusinessSuspendedEmailHtml({
            ownerName: owner.name,
            businessName: business.name,
            reason,
          }),
        }).catch(err => console.warn('[EMAIL] Error enviando correo de suspensión:', err));
      }
    } catch (err) {
      console.warn('[BUSINESS_SERVICE] Error emitiendo notificación de suspensión:', err);
    }

    // Invalidar cachés
    await Promise.all([
      this.cache.del(`business:detail:${id}`),
      this.cache.delPattern('businesses:list:*'),
      this.cache.del('admin:stats')
    ]);

    if (this.auditService) {
      const admin = await this.userRepo.findById(adminId);
      await this.auditService.recordLog({
        adminId,
        adminName: admin?.name || `Admin #${adminId}`,
        action: 'BUSINESS_SUSPENDED',
        targetType: 'Business',
        targetId: id,
        details: `Comercio "${business.name}" suspendido temporalmente. Motivo: ${reason}`
      });
    }

    return updated;
  }

  async reactivateBusiness(id: number, adminId: number) {
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

    const owner = await this.userRepo.findById(business.ownerId);

    // Notificación in-app al dueño
    try {
      if (this.notificationService) {
        await this.notificationService.createNotification({
          userId: business.ownerId,
          type: 'BUSINESS_REACTIVATED',
          title: '¡Tu comercio ha sido reactivado!',
          message: `El comercio "${business.name}" ha sido reactivado por administración y vuelve a estar visible en el catálogo para recibir reservas.`
        });
      }

      // Email al dueño
      if (owner?.email) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://turnos-ya-frontend-web-delta.vercel.app';
        sendEmail({
          to: owner.email,
          subject: `¡Comercio "${business.name}" reactivado con éxito! — Turnos Ya`,
          html: getBusinessReactivatedEmailHtml({
            ownerName: owner.name,
            businessName: business.name,
            frontendUrl,
          }),
        }).catch(err => console.warn('[EMAIL] Error enviando correo de reactivación:', err));
      }
    } catch (err) {
      console.warn('[BUSINESS_SERVICE] Error emitiendo notificación de reactivación:', err);
    }

    // Invalidar cachés
    await Promise.all([
      this.cache.del(`business:detail:${id}`),
      this.cache.delPattern('businesses:list:*'),
      this.cache.del('admin:stats')
    ]);

    if (this.auditService) {
      const admin = await this.userRepo.findById(adminId);
      await this.auditService.recordLog({
        adminId,
        adminName: admin?.name || `Admin #${adminId}`,
        action: 'BUSINESS_REACTIVATED',
        targetType: 'Business',
        targetId: id,
        details: `Comercio "${business.name}" reactivado y habilitado en catálogo.`
      });
    }

    return updated;
  }

  async deleteBusinessByAdmin(
    id: number,
    adminId: number,
    reason: string,
    deleteOwner: boolean = false,
    ipAddress?: string
  ) {
    const business = await this.businessRepo.findById(id);
    if (!business) {
      throw new AppError('Negocio no encontrado', 404);
    }

    const owner = await this.userRepo.findById(business.ownerId);
    const admin = await this.userRepo.findById(adminId);
    const adminName = admin?.name || `Admin #${adminId}`;

    const canDeleteOwner = Boolean(
      deleteOwner &&
      owner &&
      owner.role !== 'administrator' &&
      owner.id !== adminId
    );

    // 1. Registrar evidencia forense inmutable en audit_logs ANTES de eliminar físicamente
    if (this.auditService) {
      const forensicDetails = [
        `Baja definitiva / Fraude de comercio "${business.name}" (ID #${business.id})`,
        `Rubro: ${business.category || 'Sin rubro'}`,
        business.cuit ? `CUIT: ${business.cuit}` : null,
        business.address ? `Dirección: ${business.address}` : null,
        `Solicitante: ${owner?.name || 'Desconocido'} (ID #${business.ownerId}, Email: ${owner?.email || 'N/A'})`,
        `Cuenta del solicitante eliminada: ${canDeleteOwner ? 'SÍ (Purga conjunta por spam/fraude)' : 'NO'}`,
        `Motivo: ${reason}`
      ]
        .filter(Boolean)
        .join(' | ');

      await this.auditService.recordLog({
        adminId,
        adminName,
        action: 'BUSINESS_DELETED_FRAUD',
        targetType: 'Business',
        targetId: id,
        details: forensicDetails,
        ipAddress: ipAddress || null
      });
    }

    // 2. Eliminar físicamente el negocio de la base de datos operativa
    await this.businessRepo.delete(id);

    // 3. Opcionalmente eliminar la cuenta del solicitante o notificarle la baja definitiva
    let deletedOwnerId: number | null = null;
    if (canDeleteOwner && owner) {
      await this.userRepo.delete(owner.id);
      deletedOwnerId = owner.id;
    } else if (owner) {
      try {
        if (this.notificationService) {
          await this.notificationService.createNotification({
            userId: owner.id,
            type: 'BUSINESS_DELETED',
            title: 'Solicitud de negocio rechazada definitivamente',
            message: `La solicitud o registro del comercio "${business.name}" fue dada de baja de forma definitiva por administración: ${reason}.`
          });
        }
      } catch (err) {
        console.warn('[BUSINESS_SERVICE] Error notificando baja definitiva de comercio:', err);
      }
    }

    // 4. Invalidar cachés
    await Promise.all([
      this.cache.del(`business:detail:${id}`),
      this.cache.delPattern('businesses:list:*'),
      this.cache.del('admin:stats')
    ]);

    return {
      message: canDeleteOwner
        ? `Comercio "${business.name}" y cuenta del usuario solicitante eliminados definitivamente. Registro forense guardado en Auditoría.`
        : `Comercio "${business.name}" eliminado definitivamente. Registro forense guardado en Auditoría.`,
      deletedBusinessId: id,
      deletedOwnerId
    };
  }
}
