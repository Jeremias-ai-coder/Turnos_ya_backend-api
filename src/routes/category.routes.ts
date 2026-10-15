import { Router } from 'express';
import { categoryController } from '../container';

const router = Router();

router.get('/', categoryController.getCategories);
router.get('/:slug', categoryController.getCategoryBySlug);

export default router;
