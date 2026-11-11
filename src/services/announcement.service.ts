import { PrismaClient } from '@prisma/client';
import { CacheService, cacheService } from './cache.service';
import { AppError } from '../middlewares/errorHandler';

export interface SystemAnnouncement {
  id: number;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  isActive: boolean;
  linkUrl?: string | null;
  linkText?: string | null;
  expiresAt?: Date | null;
  createdBy: number;
  createdAt: Date;
}

export class AnnouncementService {
  private tableInitialized = false;

  constructor(
    private prisma: PrismaClient,
    private cache: CacheService = cacheService
  ) {}

  private async ensureTable() {
    if (this.tableInitialized) return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS system_announcements (
          id INT AUTO_INCREMENT PRIMARY KEY,
          message TEXT NOT NULL,
          type VARCHAR(20) DEFAULT 'info',
          is_active BOOLEAN DEFAULT TRUE,
          link_url VARCHAR(255) NULL,
          link_text VARCHAR(100) NULL,
          expires_at TIMESTAMP NULL,
          created_by INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.tableInitialized = true;
    } catch (err) {
      console.warn('[ANNOUNCEMENTS] Warning al verificar tabla system_announcements:', err);
    }
  }

  async getActiveAnnouncement(): Promise<any | null> {
    await this.ensureTable();
    return this.cache.getOrSet(
      'announcement:active',
      async () => {
        try {
          const rows: any[] = await this.prisma.$queryRawUnsafe(`
            SELECT id, message, type, is_active AS isActive, link_url AS linkUrl, link_text AS linkText, expires_at AS expiresAt, created_by AS createdBy, created_at AS createdAt
            FROM system_announcements
            WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY id DESC
            LIMIT 1
          `);
          return rows.length > 0 ? rows[0] : null;
        } catch (err) {
          console.error('[ANNOUNCEMENTS] Error obteniendo aviso activo:', err);
          return null;
        }
      },
      60 // 60 segundos TTL
    );
  }

  async getAllAnnouncements(): Promise<any[]> {
    await this.ensureTable();
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT id, message, type, is_active AS isActive, link_url AS linkUrl, link_text AS linkText, expires_at AS expiresAt, created_by AS createdBy, created_at AS createdAt
        FROM system_announcements
        ORDER BY id DESC
        LIMIT 50
      `);
      return rows;
    } catch (err) {
      console.error('[ANNOUNCEMENTS] Error listando avisos:', err);
      return [];
    }
  }

  async createAnnouncement(data: {
    message: string;
    type?: string;
    linkUrl?: string;
    linkText?: string;
    expiresAt?: string;
    createdBy: number;
  }) {
    await this.ensureTable();
    const cleanMessage = data.message?.trim();
    if (!cleanMessage || cleanMessage.length < 5) {
      throw new AppError('El mensaje del aviso debe contener al menos 5 caracteres', 400);
    }

    const type = ['info', 'warning', 'danger', 'success'].includes(data.type || '')
      ? data.type
      : 'info';

    const linkUrl = data.linkUrl?.trim() || null;
    const linkText = data.linkText?.trim() || null;
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO system_announcements (message, type, is_active, link_url, link_text, expires_at, created_by)
       VALUES (?, ?, 1, ?, ?, ?, ?)`,
      cleanMessage,
      type,
      linkUrl,
      linkText,
      expiresAt,
      data.createdBy
    );

    await this.cache.del('announcement:active');
    return this.getActiveAnnouncement();
  }

  async toggleAnnouncement(id: number) {
    await this.ensureTable();
    await this.prisma.$executeRawUnsafe(
      `UPDATE system_announcements SET is_active = NOT is_active WHERE id = ?`,
      id
    );
    await this.cache.del('announcement:active');
    return { success: true, id };
  }

  async deleteAnnouncement(id: number) {
    await this.ensureTable();
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM system_announcements WHERE id = ?`,
      id
    );
    await this.cache.del('announcement:active');
    return { success: true, id };
  }
}
