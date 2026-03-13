import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as auditLogController from '../controllers/audit-log.controller';

const router = Router();

// GET /api/audit-logs
router.get('/', authMiddleware, auditLogController.list);

export default router;
