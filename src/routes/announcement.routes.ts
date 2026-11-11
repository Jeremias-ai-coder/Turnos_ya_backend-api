import { Router } from 'express';
import { announcementController } from '../container';

const router = Router();

// GET /api/v1/announcements/active — Obtener el aviso activo de sistema (público)
router.get('/active', announcementController.getActiveAnnouncement);

export default router;

