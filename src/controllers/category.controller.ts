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

  getAdminCategories = async (_req: Request, res: Response) => {
    const categories = await this.categoryService.getAllCategoriesForAdmin();
    res.json({
      data: categories,
      meta: { total: categories.length }
    });
  };

  createCategory = async (req: Request, res: Response) => {
    const created = await this.categoryService.createCategory(req.body);
    res.status(201).json(created);
  };

  updateCategory = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const updated = await this.categoryService.updateCategory(id, req.body);
    res.json(updated);
  };

  toggleCategoryStatus = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const updated = await this.categoryService.toggleCategoryStatus(id);
    res.json(updated);
  };

  deleteCategory = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const deleted = await this.categoryService.deleteCategory(id);
    res.json({ message: 'Categoría eliminada exitosamente', category: deleted });
  };
}
