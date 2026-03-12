import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as milestoneController from '../controllers/milestone.controller';

const router = Router({ mergeParams: true });

// GET /api/projects/:projectId/milestones
router.get('/', authMiddleware, milestoneController.list);

// GET /api/projects/:projectId/milestones/:id
router.get('/:id', authMiddleware, milestoneController.get);

// POST /api/projects/:projectId/milestones
router.post('/', authMiddleware, milestoneController.create);

// PUT /api/projects/:projectId/milestones/:id
router.put('/:id', authMiddleware, milestoneController.update);

// DELETE /api/projects/:projectId/milestones/:id
router.delete('/:id', authMiddleware, milestoneController.remove);

export default router;
