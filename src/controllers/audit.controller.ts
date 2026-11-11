import { Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { AppError } from '../middlewares/errorHandler';

export class AuditController {
  constructor(private auditService: AuditService) {}

  getAuditLogs = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const action = req.query.action as string;
    const search = req.query.search as string;

    const result = await this.auditService.getAuditLogs(page, limit, action, search);
    res.json(result);
  };

  emergencyCancel = async (req: Request, res: Response) => {
    const businessId = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    const adminName = (req as any).user.name || 'Administrador';
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';

    const { date, reason } = req.body;
    if (!date || !reason || reason.trim().length < 5) {
      throw new AppError('Se requiere la fecha y un motivo detallado (mínimo 5 caracteres) para la cancelación de emergencia.', 400);
    }

    const result = await this.auditService.emergencyCancelBusinessAppointments({
      businessId,
      date,
      reason: reason.trim(),
      adminId,
      adminName,
      ipAddress
    });

    res.json(result);
  };
}
