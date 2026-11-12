import { Request, Response } from 'express';
import { CommunityService } from '../services/community.service';

export class CommunityController {
  constructor(private communityService: CommunityService) {}

  getMyFavorites = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const favorites = await this.communityService.getUserFavorites(userId);
    res.json({ data: favorites });
  };

  getBusinessCommunitySummary = async (req: Request, res: Response) => {
    const businessId = parseInt(req.params.id);
    const userId = (req as any).user?.id;
    const summary = await this.communityService.getBusinessCommunitySummary(businessId, userId);
    res.json(summary);
  };

  toggleFollow = async (req: Request, res: Response) => {
    const businessId = parseInt(req.params.id);
    const userId = (req as any).user.id;
    const receiveNotifications =
      req.body?.receiveNotifications !== undefined ? Boolean(req.body.receiveNotifications) : true;
    const result = await this.communityService.toggleFollow(userId, businessId, receiveNotifications);
    res.json(result);
  };

  updateNotificationPreference = async (req: Request, res: Response) => {
    const businessId = parseInt(req.params.id);
    const userId = (req as any).user.id;
    const receiveNotifications = Boolean(req.body?.receiveNotifications);
    const result = await this.communityService.updateNotificationPreference(userId, businessId, receiveNotifications);
    res.json(result);
  };

  sendBroadcast = async (req: Request, res: Response) => {
    const businessId = parseInt(req.params.id);
    const senderUser = (req as any).user;
    const result = await this.communityService.sendBroadcast(businessId, senderUser, {
      type: req.body?.type,
      title: req.body?.title,
      message: req.body?.message
    });
    res.status(201).json(result);
  };

  addClosedDate = async (req: Request, res: Response) => {
    const businessId = parseInt(req.params.id);
    const senderUser = (req as any).user;
    const result = await this.communityService.addClosedDate(businessId, senderUser, {
      closedDate: req.body?.closedDate,
      reason: req.body?.reason,
      notifyFollowers: Boolean(req.body?.notifyFollowers)
    });
    res.status(201).json(result);
  };

  removeClosedDate = async (req: Request, res: Response) => {
    const businessId = parseInt(req.params.id);
    const senderUser = (req as any).user;
    const closedDate = req.params.date;
    const result = await this.communityService.removeClosedDate(businessId, senderUser, closedDate);
    res.json(result);
  };
}

