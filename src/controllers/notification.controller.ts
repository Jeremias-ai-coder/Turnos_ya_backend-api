import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  getNotifications = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const limit = Number(req.query.limit) || 30;
    const page = Number(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const result = await this.notificationService.getUserNotifications(userId, limit, skip);
    res.json(result);
  };

  markAsRead = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const id = Number(req.params.id);

    const result = await this.notificationService.markAsRead(id, userId);
    res.json(result);
  };

  markAllAsRead = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.notificationService.markAllAsRead(userId);
    res.json(result);
  };
}
