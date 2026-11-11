import { Request, Response } from 'express';
import { BusinessService } from '../services/business.service';
import { createBusinessSchema, updateBusinessSchema, rejectBusinessSchema } from '../validators/business.validator';
import { AppError } from '../middlewares/errorHandler';

export class BusinessController {
  constructor(private businessService: BusinessService) {}

  getBusinesses = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search || req.query.q) as string | undefined;
    const userRole = (req as any).user?.role;

    // Solo un administrador autenticado puede consultar otros estados que no sean 'approved'
    let status: any = 'approved';
    if (req.query.status && userRole === 'administrator') {
      status = req.query.status;
    }

    const result = await this.businessService.getBusinesses(page, limit, search, status);
    res.json(result);
  };

  getBusiness = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const business = await this.businessService.getBusinessById(id);
    res.json(business);
  };

  createBusiness = async (req: Request, res: Response) => {
    const parsed = createBusinessSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
      throw new AppError('Datos de negocio inválidos', 400, details);
    }

    const userId = (req as any).user.id;
    const business = await this.businessService.createBusiness(userId, parsed.data as any);
    res.status(201).json(business);
  };

  getMyBusinesses = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.businessService.getMyBusinesses(userId);
    res.json(result);
  };

  updateBusiness = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const parsed = updateBusinessSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
      throw new AppError('Datos de actualización inválidos', 400, details);
    }

    const updated = await this.businessService.updateBusiness(id, userId, userRole, parsed.data as any);
    res.json(updated);
  };

  approveBusiness = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    const result = await this.businessService.approveBusiness(id, adminId);
    res.json(result);
  };

  rejectBusiness = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    const parsed = rejectBusinessSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }
    const result = await this.businessService.rejectBusiness(id, adminId, parsed.data.reason);
    res.json(result);
  };

  suspendBusiness = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    const parsed = rejectBusinessSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }
    const result = await this.businessService.suspendBusiness(id, adminId, parsed.data.reason);
    res.json(result);
  };

  reactivateBusiness = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    const result = await this.businessService.reactivateBusiness(id, adminId);
    res.json(result);
  };
}
