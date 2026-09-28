import { Router } from 'express';
import { notificationController } from '../container';
import { authGuard } from '../middlewares/authGuard';

const router = Router();

router.use(authGuard); // Todas las rutas de notificaciones requieren autenticación

router.get('/', notificationController.getNotifications);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

export default router;
