import { Router } from 'express';
import { bugReportController } from '../container';
import { authGuard } from '../middlewares/authGuard';

const router = Router();

// POST /api/v1/reports — Crear un nuevo reporte de error (requiere autenticación)
router.post('/', authGuard, bugReportController.createBugReport);

export default router;
