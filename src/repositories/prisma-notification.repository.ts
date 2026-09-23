import { PrismaClient, type Notification } from '@prisma/client';
import { INotificationRepository, CreateNotificationDTO } from '../interfaces/notification.interface';

export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateNotificationDTO): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type || 'INFO',
        isRead: false
      }
    });
  }

  async findByUserId(userId: number, limit: number = 30, skip: number = 0): Promise<[Notification[], number]> {
    return this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip
      }),
      this.prisma.notification.count({
        where: { userId }
      })
    ]);
  }

  async countUnread(userId: number): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false }
    });
  }

  async markAsRead(id: number, userId: number): Promise<Notification | null> {
    const notif = await this.prisma.notification.findFirst({
      where: { id, userId }
    });
    if (!notif) return null;

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
  }

  async markAllAsRead(userId: number): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
    return result.count;
  }
}
