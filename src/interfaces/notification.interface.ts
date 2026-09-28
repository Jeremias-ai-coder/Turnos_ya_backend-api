import type { Notification } from '@prisma/client';

export interface CreateNotificationDTO {
  userId: number;
  title: string;
  message: string;
  type?: string;
}

export interface INotificationRepository {
  create(data: CreateNotificationDTO): Promise<Notification>;
  findByUserId(userId: number, limit?: number, skip?: number): Promise<[Notification[], number]>;
  countUnread(userId: number): Promise<number>;
  markAsRead(id: number, userId: number): Promise<Notification | null>;
  markAllAsRead(userId: number): Promise<number>;
}
