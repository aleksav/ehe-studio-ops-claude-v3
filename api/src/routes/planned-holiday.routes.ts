import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as plannedHolidayController from '../controllers/planned-holiday.controller';

const router = Router({ mergeParams: true });

// GET /api/team-members/:id/holidays
router.get('/', authMiddleware, plannedHolidayController.list);

// GET /api/team-members/:id/holiday-allowance
router.get('/allowance', authMiddleware, plannedHolidayController.allowance);

// POST /api/team-members/:id/holidays
router.post('/', authMiddleware, plannedHolidayController.create);

// PUT /api/team-members/:id/holidays/:holidayId
router.put('/:holidayId', authMiddleware, plannedHolidayController.update);

// DELETE /api/team-members/:id/holidays/:holidayId
router.delete('/:holidayId', authMiddleware, plannedHolidayController.remove);

export default router;
