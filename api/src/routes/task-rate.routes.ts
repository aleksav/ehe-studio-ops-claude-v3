import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as taskRateController from '../controllers/task-rate.controller';

const router = Router();

// GET /api/task-rates
router.get('/', authMiddleware, taskRateController.list);

// GET /api/task-rates/current
router.get('/current', authMiddleware, taskRateController.current);

// POST /api/task-rates
router.post('/', authMiddleware, taskRateController.create);

// PUT /api/task-rates/:id
router.put('/:id', authMiddleware, taskRateController.update);

// DELETE /api/task-rates/:id
router.delete('/:id', authMiddleware, taskRateController.remove);

export default router;
