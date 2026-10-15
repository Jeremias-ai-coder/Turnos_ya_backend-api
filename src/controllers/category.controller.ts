import { Request, Response } from 'express';
import { CategoryService } from '../services/category.service';
import { AppError } from '../middlewares/errorHandler';

export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  getCategories = async (_req: Request, res: Response) => {
    const categories = await this.categoryService.getAllCategories();
    res.json({
      data: categories,
      meta: { total: categories.length }
    });
  };

  getCategoryBySlug = async (req: Request, res: Response) => {
    const { slug } = req.params;
    const category = await this.categoryService.getCategoryBySlug(slug);
    if (!category) {
      throw new AppError('Categoría no encontrada', 404);
    }
    res.json(category);
  };
}
