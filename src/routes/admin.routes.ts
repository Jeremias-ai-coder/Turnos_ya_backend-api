import { Router } from 'express';
import { adminController, bugReportController, businessController, reviewController } from '../container';
import { authGuard } from '../middlewares/authGuard';
import { AppError } from '../middlewares/errorHandler';

const router = Router();

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'administrator') {
    throw new AppError('Acceso denegado: se requiere rol de administrador', 403);
  }
  next();
};

// GET /api/v1/admin/users — Listar todos los usuarios (admin only)
router.get('/users', authGuard, requireAdmin, adminController.getAllUsers);

// PATCH /api/v1/admin/users/:id/role — Cambiar rol de usuario (admin only)
router.patch('/users/:id/role', authGuard, requireAdmin, adminController.updateUserRole);

// DELETE /api/v1/admin/users/:id — Eliminar usuario (admin only)
router.delete('/users/:id', authGuard, requireAdmin, adminController.deleteUser);

// GET /api/v1/admin/businesses — Listar comercios (soporta ?status=pending_approval o ALL)
router.get('/businesses', authGuard, requireAdmin, businessController.getBusinesses);

// PATCH /api/v1/admin/businesses/:id/approve — Aprobar comercio y dar de alta
router.patch('/businesses/:id/approve', authGuard, requireAdmin, businessController.approveBusiness);

// PATCH /api/v1/admin/businesses/:id/reject — Rechazar comercio con motivo
router.patch('/businesses/:id/reject', authGuard, requireAdmin, businessController.rejectBusiness);

// PATCH /api/v1/admin/businesses/:id/suspend — Suspender comercio con motivo
router.patch('/businesses/:id/suspend', authGuard, requireAdmin, businessController.suspendBusiness);

// PATCH /api/v1/admin/businesses/:id/reactivate — Reactivar comercio suspendido
router.patch('/businesses/:id/reactivate', authGuard, requireAdmin, businessController.reactivateBusiness);

// GET /api/v1/admin/reviews — Listar reseñas globales para moderación (admin only)
router.get('/reviews', authGuard, requireAdmin, reviewController.getAllReviewsForAdmin);

// DELETE /api/v1/admin/reviews/:id — Moderar/eliminar reseña inapropiada (admin only)
router.delete('/reviews/:id', authGuard, requireAdmin, reviewController.deleteReviewByAdmin);

// GET /api/v1/admin/stats — Estadísticas globales
router.get('/stats', authGuard, requireAdmin, adminController.getStats);

// GET /api/v1/admin/appointments — Todos los turnos del sistema
router.get('/appointments', authGuard, requireAdmin, adminController.getAllAppointments);

// GET /api/v1/admin/reports — Listar reportes de errores (admin only)
router.get('/reports', authGuard, requireAdmin, bugReportController.getAdminBugReports);

// PATCH /api/v1/admin/reports/:id/status — Actualizar estado del reporte (admin only)
router.patch('/reports/:id/status', authGuard, requireAdmin, bugReportController.updateBugReportStatus);

// GET /api/v1/admin/cache/stats — Estadísticas y salud de la caché inteligente (admin only)
router.get('/cache/stats', authGuard, requireAdmin, adminController.getCacheStats);

// POST /api/v1/admin/cache/clear — Purgar caché global manualmente (admin only)
router.post('/cache/clear', authGuard, requireAdmin, adminController.clearCache);

export default router;
