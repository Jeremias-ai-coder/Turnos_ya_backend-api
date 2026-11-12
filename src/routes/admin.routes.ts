import { Router } from 'express';
import {
  adminController,
  bugReportController,
  businessController,
  reviewController,
  categoryController,
  announcementController,
  auditController
} from '../container';
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

// DELETE /api/v1/admin/businesses/:id — Eliminar comercio definitivamente (fraude / baja con registro forense)
router.delete('/businesses/:id', authGuard, requireAdmin, businessController.deleteBusinessByAdmin);

// POST /api/v1/admin/businesses/:id/emergency-cancel — Cancelación de emergencia por fuerza mayor
router.post('/businesses/:id/emergency-cancel', authGuard, requireAdmin, auditController.emergencyCancel);

// --- MODERACIÓN DE RESEÑAS (IN-SITU EN EL COMERCIO) ---
// PATCH /api/v1/admin/reviews/:id/hide — Ocultar reseña de la vista pública (admin only)
router.patch('/reviews/:id/hide', authGuard, requireAdmin, reviewController.hideReview);

// PATCH /api/v1/admin/reviews/:id/unhide — Restaurar reseña a la vista pública (admin only)
router.patch('/reviews/:id/unhide', authGuard, requireAdmin, reviewController.unhideReview);

// DELETE /api/v1/admin/reviews/:id — Moderar/eliminar permanentemente reseña inapropiada (admin only)
router.delete('/reviews/:id', authGuard, requireAdmin, reviewController.deleteReviewByAdmin);

// --- GESTIÓN DE CATEGORÍAS Y RUBROS ---
// GET /api/v1/admin/categories — Listar categorías completas con métricas
router.get('/categories', authGuard, requireAdmin, categoryController.getAdminCategories);

// POST /api/v1/admin/categories — Crear nueva categoría
router.post('/categories', authGuard, requireAdmin, categoryController.createCategory);

// PUT /api/v1/admin/categories/:id — Actualizar categoría existente
router.put('/categories/:id', authGuard, requireAdmin, categoryController.updateCategory);

// PATCH /api/v1/admin/categories/:id/toggle — Activar/desactivar categoría
router.patch('/categories/:id/toggle', authGuard, requireAdmin, categoryController.toggleCategoryStatus);

// DELETE /api/v1/admin/categories/:id — Eliminar categoría sin comercios
router.delete('/categories/:id', authGuard, requireAdmin, categoryController.deleteCategory);

// --- AVISOS Y BANNERS DEL SISTEMA (BROADCAST) ---
// GET /api/v1/admin/announcements — Listar todos los avisos
router.get('/announcements', authGuard, requireAdmin, announcementController.getAllAnnouncements);

// POST /api/v1/admin/announcements — Crear nuevo aviso
router.post('/announcements', authGuard, requireAdmin, announcementController.createAnnouncement);

// PATCH /api/v1/admin/announcements/:id/toggle — Activar o desactivar aviso
router.patch('/announcements/:id/toggle', authGuard, requireAdmin, announcementController.toggleAnnouncement);

// DELETE /api/v1/admin/announcements/:id — Eliminar aviso
router.delete('/announcements/:id', authGuard, requireAdmin, announcementController.deleteAnnouncement);

// --- AUDITORÍA DEL SISTEMA (AUDIT TRAIL) ---
// GET /api/v1/admin/audit-logs — Historial de acciones críticas del sistema
router.get('/audit-logs', authGuard, requireAdmin, auditController.getAuditLogs);

// --- MÉTRICAS Y REPORTES ---
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
