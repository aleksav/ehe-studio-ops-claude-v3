import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  listTasksHandler,
  getTaskHandler,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
} from '../controllers/task.controller';

const router = Router({ mergeParams: true });

// GET /api/projects/:projectId/tasks
router.get('/', authMiddleware, listTasksHandler);

// GET /api/projects/:projectId/tasks/:id
router.get('/:id', authMiddleware, getTaskHandler);

// POST /api/projects/:projectId/tasks
router.post('/', authMiddleware, createTaskHandler);

// PUT /api/projects/:projectId/tasks/:id
router.put('/:id', authMiddleware, updateTaskHandler);

// DELETE /api/projects/:projectId/tasks/:id
router.delete('/:id', authMiddleware, deleteTaskHandler);

export default router;
