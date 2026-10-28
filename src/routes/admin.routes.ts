import { Router } from 'express';
import { adminController, bugReportController } from '../container';
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
