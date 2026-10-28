import { Router } from 'express';
import { categoryController } from '../container';
import { httpCacheControl } from '../middlewares/cacheControl';

const router = Router();

// Cachear categorías públicamente por 15 minutos en navegadores y proxies
router.get('/', httpCacheControl({ maxAgeSeconds: 900, staleWhileRevalidateSeconds: 1800 }), categoryController.getCategories);
router.get('/:slug', httpCacheControl({ maxAgeSeconds: 900, staleWhileRevalidateSeconds: 1800 }), categoryController.getCategoryBySlug);

export default router;
