import { Request, Response } from 'express';
import { AnnouncementService } from '../services/announcement.service';

export class AnnouncementController {
  constructor(private announcementService: AnnouncementService) {}

  getActiveAnnouncement = async (_req: Request, res: Response) => {
    const active = await this.announcementService.getActiveAnnouncement();
    res.json({ data: active });
  };

  getAllAnnouncements = async (_req: Request, res: Response) => {
    const list = await this.announcementService.getAllAnnouncements();
    res.json({ data: list, meta: { total: list.length } });
  };

  createAnnouncement = async (req: Request, res: Response) => {
    const adminId = (req as any).user.id;
    const result = await this.announcementService.createAnnouncement({
      ...req.body,
      createdBy: adminId
    });
    res.status(201).json(result);
  };

  toggleAnnouncement = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await this.announcementService.toggleAnnouncement(id);
    res.json(result);
  };

  deleteAnnouncement = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await this.announcementService.deleteAnnouncement(id);
    res.json(result);
  };
}
