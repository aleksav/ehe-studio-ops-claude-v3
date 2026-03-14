import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as publicHolidayController from '../controllers/public-holiday.controller';

const router = Router();

// GET /api/public-holidays
router.get('/', authMiddleware, publicHolidayController.list);

// GET /api/public-holidays/:id
router.get('/:id', authMiddleware, publicHolidayController.get);

// POST /api/public-holidays
router.post('/', authMiddleware, publicHolidayController.create);

// PUT /api/public-holidays/:id
router.put('/:id', authMiddleware, publicHolidayController.update);

// DELETE /api/public-holidays/:id
router.delete('/:id', authMiddleware, publicHolidayController.remove);

export default router;
