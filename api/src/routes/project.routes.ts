import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as projectController from '../controllers/project.controller';

const router = Router();

// GET /api/projects
router.get('/', authMiddleware, projectController.list);

// GET /api/projects/:id
router.get('/:id', authMiddleware, projectController.get);

// POST /api/projects
router.post('/', authMiddleware, projectController.create);

// PUT /api/projects/:id
router.put('/:id', authMiddleware, projectController.update);

// DELETE /api/projects/:id — archive
router.delete('/:id', authMiddleware, projectController.archive);

export default router;
