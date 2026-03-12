import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  listAssignmentsHandler,
  createAssignmentHandler,
  deleteAssignmentHandler,
} from '../controllers/task-assignment.controller';

const router = Router({ mergeParams: true });

// GET /api/tasks/:taskId/assignments
router.get('/', authMiddleware, listAssignmentsHandler);

// POST /api/tasks/:taskId/assignments
router.post('/', authMiddleware, createAssignmentHandler);

// DELETE /api/tasks/:taskId/assignments/:teamMemberId
router.delete('/:teamMemberId', authMiddleware, deleteAssignmentHandler);

export default router;
