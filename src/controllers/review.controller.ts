import { Request, Response } from 'express';
import { ReviewService } from '../services/review.service';
import { createReviewSchema } from '../validators/review.validator';
import { AppError } from '../middlewares/errorHandler';

export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  createReview = async (req: Request, res: Response) => {
    const appointmentId = parseInt(req.params.id);
    const userId = (req as any).user.id;

    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
      throw new AppError('Datos de reseña inválidos', 400, details);
    }

    const review = await this.reviewService.createReview(userId, appointmentId, parsed.data);
    res.status(201).json(review);
  };

  getBusinessReviews = async (req: Request, res: Response) => {
    const businessId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const isAdmin = (req as any).user?.role === 'administrator';

    const result = await this.reviewService.getBusinessReviews(businessId, page, limit, isAdmin);
    res.json(result);
  };

  getAllReviewsForAdmin = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
    const search = req.query.search as string;

    const result = await this.reviewService.getAllReviewsForAdmin(page, limit, rating, search);
    res.json(result);
  };

  hideReview = async (req: Request, res: Response) => {
    const reviewId = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    const adminName = (req as any).user.name || 'Administrador';
    const reason = req.body?.reason;

    const result = await this.reviewService.hideReviewByAdmin(reviewId, adminId, adminName, reason);
    res.json(result);
  };

  unhideReview = async (req: Request, res: Response) => {
    const reviewId = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    const adminName = (req as any).user.name || 'Administrador';

    const result = await this.reviewService.unhideReviewByAdmin(reviewId, adminId, adminName);
    res.json(result);
  };

  deleteReviewByAdmin = async (req: Request, res: Response) => {
    const reviewId = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    const adminName = (req as any).user.name || 'Administrador';
    const reason = req.body?.reason;

    const result = await this.reviewService.deleteReviewByAdmin(reviewId, adminId, adminName, reason);
    res.json(result);
  };
}
