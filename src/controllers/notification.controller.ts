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

  streamNotifications = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // Enviar evento de conexión inicial
    res.write(': connected\n\n');

    this.notificationService.registerSseClient(userId, res);

    // Heartbeat cada 25 segundos para mantener activo el túnel y evitar timeouts de proxy/navegador
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      this.notificationService.unregisterSseClient(userId, res);
    });
  };
}
