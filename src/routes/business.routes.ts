import { Router } from 'express';
import { businessController, serviceController, scheduleController, reviewController, appointmentController } from '../container';
import { authGuard, optionalAuth } from '../middlewares/authGuard';

const router = Router();

router.get('/', businessController.getBusinesses);
router.post('/', authGuard, businessController.createBusiness);
router.get('/my', authGuard, businessController.getMyBusinesses);
router.get('/:id', businessController.getBusiness);
router.patch('/:id', authGuard, businessController.updateBusiness);

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
