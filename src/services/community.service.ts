import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification.service';
import { CacheService, cacheService } from './cache.service';
import { AppError } from '../middlewares/errorHandler';

export class CommunityService {
  private tablesInitialized = false;
  private readonly WEEKLY_BROADCAST_LIMIT = 3;

  constructor(
    private prisma: PrismaClient,
    private notificationService?: NotificationService,
    private cache: CacheService = cacheService
  ) {}

  private async ensureTables() {
    if (this.tablesInitialized) return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS business_followers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          business_id INT NOT NULL,
          receive_notifications BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_user_business (user_id, business_id)
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS business_broadcasts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          business_id INT NOT NULL,
          owner_id INT NOT NULL,
          type VARCHAR(50) NOT NULL DEFAULT 'PROMO',
          title VARCHAR(160) NOT NULL,
          message TEXT NOT NULL,
          recipients_count INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS business_closed_dates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          business_id INT NOT NULL,
          closed_date VARCHAR(20) NOT NULL,
          reason VARCHAR(255) NOT NULL DEFAULT 'Cerrado por feriado / día especial',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_business_date (business_id, closed_date)
        )
      `);

      this.tablesInitialized = true;
    } catch (err) {
      console.warn('[COMMUNITY] Warning al verificar tablas de comunidad y feriados:', err);
    }
  }

  async getUserFavorites(userId: number) {
    await this.ensureTables();
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT business_id as businessId, receive_notifications as receiveNotifications, created_at as createdAt
         FROM business_followers
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        userId
      );
      return rows.map((r) => ({
        businessId: Number(r.businessId),
        receiveNotifications: Boolean(r.receiveNotifications),
        createdAt: r.createdAt
      }));
    } catch (err) {
      console.error('[COMMUNITY] Error consultando favoritos del usuario:', err);
      return [];
    }
  }

  async getBusinessCommunitySummary(businessId: number, userId?: number) {
    await this.ensureTables();
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      const countRows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as total FROM business_followers WHERE business_id = ?`,
        businessId
      );
      const followersCount = Number(countRows[0]?.total || 0);

      let isFollowing = false;
      let receiveNotifications = true;
      if (userId) {
        const userRows: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT receive_notifications as receiveNotifications
           FROM business_followers
           WHERE user_id = ? AND business_id = ?
           LIMIT 1`,
          userId,
          businessId
        );
        if (userRows.length > 0) {
          isFollowing = true;
          receiveNotifications = Boolean(userRows[0].receiveNotifications);
        }
      }

      const closedDatesRows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, closed_date as closedDate, reason, created_at as createdAt
         FROM business_closed_dates
         WHERE business_id = ? AND closed_date >= ?
         ORDER BY closed_date ASC`,
        businessId,
        todayStr
      );

      const recentBroadcasts: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, type, title, message, recipients_count as recipientsCount, created_at as createdAt
         FROM business_broadcasts
         WHERE business_id = ?
         ORDER BY id DESC
         LIMIT 5`,
        businessId
      );

      const weeklyRows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as used
         FROM business_broadcasts
         WHERE business_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        businessId
      );
      const weeklyBroadcastsUsed = Number(weeklyRows[0]?.used || 0);

      return {
        followersCount,
        isFollowing,
        receiveNotifications,
        closedDates: closedDatesRows.map((c) => ({
          id: Number(c.id),
          closedDate: String(c.closedDate),
          reason: String(c.reason),
          createdAt: c.createdAt
        })),
        recentBroadcasts: recentBroadcasts.map((b) => ({
          id: Number(b.id),
          type: String(b.type),
          title: String(b.title),
          message: String(b.message),
          recipientsCount: Number(b.recipientsCount || 0),
          createdAt: b.createdAt
        })),
        weeklyBroadcastsUsed,
        weeklyBroadcastsLimit: this.WEEKLY_BROADCAST_LIMIT,
        weeklyBroadcastsRemaining: Math.max(0, this.WEEKLY_BROADCAST_LIMIT - weeklyBroadcastsUsed)
      };
    } catch (err) {
      console.error('[COMMUNITY] Error obteniendo resumen de comunidad:', err);
      return {
        followersCount: 0,
        isFollowing: false,
        receiveNotifications: true,
        closedDates: [],
        recentBroadcasts: [],
        weeklyBroadcastsUsed: 0,
        weeklyBroadcastsLimit: this.WEEKLY_BROADCAST_LIMIT,
        weeklyBroadcastsRemaining: this.WEEKLY_BROADCAST_LIMIT
      };
    }
  }

  async toggleFollow(userId: number, businessId: number, receiveNotifications: boolean = true) {
    await this.ensureTables();

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new AppError('Comercio no encontrado', 404);
    }

    const existing: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM business_followers WHERE user_id = ? AND business_id = ? LIMIT 1`,
      userId,
      businessId
    );

    let isFollowing = false;
    if (existing.length > 0) {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM business_followers WHERE user_id = ? AND business_id = ?`,
        userId,
        businessId
      );
      isFollowing = false;
    } else {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO business_followers (user_id, business_id, receive_notifications) VALUES (?, ?, ?)`,
        userId,
        businessId,
        receiveNotifications ? 1 : 0
      );
      isFollowing = true;
    }

    const countRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM business_followers WHERE business_id = ?`,
      businessId
    );
    const followersCount = Number(countRows[0]?.total || 0);

    return {
      isFollowing,
      receiveNotifications: isFollowing ? receiveNotifications : false,
      followersCount
    };
  }

  async updateNotificationPreference(userId: number, businessId: number, receiveNotifications: boolean) {
    await this.ensureTables();
    await this.prisma.$executeRawUnsafe(
      `UPDATE business_followers SET receive_notifications = ? WHERE user_id = ? AND business_id = ?`,
      receiveNotifications ? 1 : 0,
      userId,
      businessId
    );
    return {
      businessId,
      receiveNotifications
    };
  }

  async sendBroadcast(
    businessId: number,
    senderUser: { id: number; role: string },
    data: { type?: string; title: string; message: string }
  ) {
    await this.ensureTables();

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new AppError('Comercio no encontrado', 404);
    }
    if (business.ownerId !== senderUser.id && senderUser.role !== 'administrator') {
      throw new AppError('No tenés permisos para enviar comunicados de este comercio', 403);
    }

    const title = (data.title || '').trim();
    const message = (data.message || '').trim();
    const type = (data.type || 'PROMO').toUpperCase();

    if (title.length < 3 || message.length < 5) {
      throw new AppError('El título y el mensaje del aviso deben ser descriptivos', 400);
    }

    // Regla Anti-Spam: Máximo 3 avisos cada 7 días
    const weeklyRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as used
       FROM business_broadcasts
       WHERE business_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      businessId
    );
    const used = Number(weeklyRows[0]?.used || 0);
    if (used >= this.WEEKLY_BROADCAST_LIMIT && senderUser.role !== 'administrator') {
      throw new AppError(
        `Límite anti-spam alcanzado (${this.WEEKLY_BROADCAST_LIMIT} avisos por semana). Podrás enviar un nuevo comunicado en los próximos días.`,
        429
      );
    }

    // Obtener seguidores suscriptos a notificaciones
    const followers: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT user_id as userId FROM business_followers WHERE business_id = ? AND receive_notifications = 1`,
      businessId
    );

    const recipientsCount = followers.length;

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO business_broadcasts (business_id, owner_id, type, title, message, recipients_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      businessId,
      senderUser.id,
      type,
      title,
      message,
      recipientsCount
    );

    const typeIcon =
      type === 'HOLIDAY' ? '🏖️' : type === 'SLOTS' ? '⚡' : type === 'NEWS' ? '📢' : '🏷️';

    if (this.notificationService && recipientsCount > 0) {
      for (const f of followers) {
        const targetUserId = Number(f.userId);
        if (!targetUserId) continue;
        await this.notificationService
          .createNotification({
            userId: targetUserId,
            type: 'BUSINESS_BROADCAST',
            title: `${typeIcon} ${business.name}: ${title}`,
            message: `${message} — Tocá para ver "${business.name}" (#BIZ_${business.id}).`
          })
          .catch(() => {});
      }
    }

    return {
      message:
        recipientsCount > 0
          ? `¡Aviso enviado con éxito a ${recipientsCount} ${recipientsCount === 1 ? 'seguidor' : 'seguidores'}!`
          : 'Aviso publicado en el perfil del comercio (aún no hay seguidores con notificaciones activas).',
      recipientsCount,
      weeklyBroadcastsRemaining: Math.max(0, this.WEEKLY_BROADCAST_LIMIT - (used + 1))
    };
  }

  async addClosedDate(
    businessId: number,
    senderUser: { id: number; role: string },
    data: { closedDate: string; reason?: string; notifyFollowers?: boolean }
  ) {
    await this.ensureTables();

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new AppError('Comercio no encontrado', 404);
    }
    if (business.ownerId !== senderUser.id && senderUser.role !== 'administrator') {
      throw new AppError('No tenés permisos para configurar feriados en este comercio', 403);
    }

    const closedDate = (data.closedDate || '').split('T')[0].trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closedDate)) {
      throw new AppError('Formato de fecha inválido (debe ser YYYY-MM-DD)', 400);
    }

    const reason = (data.reason || 'Cerrado por feriado / día especial').trim();

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO business_closed_dates (business_id, closed_date, reason)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
      businessId,
      closedDate,
      reason
    );

    // Invalidar caché de slots de ese comercio
    await this.cache.delPattern(`slots:${businessId}:*`).catch(() => {});

    // Opcionalmente notificar a los seguidores
    let notifiedCount = 0;
    if (data.notifyFollowers && this.notificationService) {
      const followers: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT user_id as userId FROM business_followers WHERE business_id = ? AND receive_notifications = 1`,
        businessId
      );
      const [y, m, d] = closedDate.split('-');
      const formattedDate = `${d}/${m}/${y}`;

      for (const f of followers) {
        const targetUserId = Number(f.userId);
        if (!targetUserId) continue;
        notifiedCount += 1;
        await this.notificationService
          .createNotification({
            userId: targetUserId,
            type: 'BUSINESS_HOLIDAY_CLOSURE',
            title: `🏖️ ${business.name} cerrado el ${formattedDate}`,
            message: `Te avisamos que "${business.name}" permanecerá cerrado el día ${formattedDate} por: ${reason} (#BIZ_${business.id}).`
          })
          .catch(() => {});
      }
    }

    return {
      message:
        notifiedCount > 0
          ? `Fecha bloqueada correctamente y aviso enviado a ${notifiedCount} seguidores.`
          : 'Fecha bloqueada como día cerrado / feriado exitosamente.',
      closedDate,
      reason,
      notifiedCount
    };
  }

  async removeClosedDate(businessId: number, senderUser: { id: number; role: string }, closedDate: string) {
    await this.ensureTables();

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new AppError('Comercio no encontrado', 404);
    }
    if (business.ownerId !== senderUser.id && senderUser.role !== 'administrator') {
      throw new AppError('No tenés permisos para modificar feriados en este comercio', 403);
    }

    const cleanDate = (closedDate || '').split('T')[0].trim();
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM business_closed_dates WHERE business_id = ? AND closed_date = ?`,
      businessId,
      cleanDate
    );

    await this.cache.delPattern(`slots:${businessId}:*`).catch(() => {});

    return { message: 'Fecha rehabilitada para recibir turnos normalmente.' };
  }

  async getClosedReasonForDate(businessId: number, dateStr: string): Promise<string | null> {
    await this.ensureTables();
    const cleanDate = (dateStr || '').split('T')[0].trim();
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT reason FROM business_closed_dates WHERE business_id = ? AND closed_date = ? LIMIT 1`,
        businessId,
        cleanDate
      );
      return rows.length > 0 ? String(rows[0].reason) : null;
    } catch {
      return null;
    }
  }
}

