import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as officeEventController from '../controllers/office-event.controller';

const router = Router();

// GET /api/office-events
router.get('/', authMiddleware, officeEventController.list);

// GET /api/office-events/:id
router.get('/:id', authMiddleware, officeEventController.get);

// POST /api/office-events
router.post('/', authMiddleware, officeEventController.create);

// PUT /api/office-events/:id
router.put('/:id', authMiddleware, officeEventController.update);

// DELETE /api/office-events/:id
router.delete('/:id', authMiddleware, officeEventController.remove);

export default router;
