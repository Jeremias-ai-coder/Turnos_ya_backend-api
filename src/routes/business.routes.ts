import { Router } from 'express';
import {
  businessController,
  serviceController,
  scheduleController,
  reviewController,
  appointmentController,
  communityController
} from '../container';
import { authGuard, optionalAuth } from '../middlewares/authGuard';

const router = Router();

router.get('/', businessController.getBusinesses);
router.post('/', authGuard, businessController.createBusiness);
router.get('/my', authGuard, businessController.getMyBusinesses);
router.get('/my/favorites', authGuard, communityController.getMyFavorites);
router.get('/:id', businessController.getBusiness);
router.patch('/:id', authGuard, businessController.updateBusiness);

// Comunidad: Seguidores / Favoritos, Difusión de Avisos y Días Cerrados / Feriados
router.get('/:id/community', optionalAuth, communityController.getBusinessCommunitySummary);
router.post('/:id/follow', authGuard, communityController.toggleFollow);
router.patch('/:id/follow/notifications', authGuard, communityController.updateNotificationPreference);
router.post('/:id/broadcasts', authGuard, communityController.sendBroadcast);
router.post('/:id/closed-dates', authGuard, communityController.addClosedDate);
router.delete('/:id/closed-dates/:date', authGuard, communityController.removeClosedDate);

// Servicios dependientes del negocio
router.get('/:id/services', serviceController.getServices);
router.post('/:id/services', authGuard, serviceController.createService);
router.put('/:id/services/:serviceId', authGuard, serviceController.updateService);
router.patch('/:id/services/:serviceId', authGuard, serviceController.updateService);
router.delete('/:id/services/:serviceId', authGuard, serviceController.deleteService);

// Horarios dependientes del negocio
router.get('/:id/schedules', scheduleController.getSchedules);
router.post('/:id/schedules', authGuard, scheduleController.createSchedule);
router.put('/:id/schedules/:scheduleId', authGuard, scheduleController.updateSchedule);
router.patch('/:id/schedules/:scheduleId', authGuard, scheduleController.updateSchedule);
router.delete('/:id/schedules/:scheduleId', authGuard, scheduleController.deleteSchedule);

// Horarios ocupados del negocio para una fecha
router.get('/:id/busy-slots', appointmentController.getBusySlots);

// Reseñas del negocio (permite ver ocultas si el solicitante es admin)
router.get('/:id/reviews', optionalAuth, reviewController.getBusinessReviews);

export default router;
