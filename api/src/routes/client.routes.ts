import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as clientController from '../controllers/client.controller';

const router = Router();

// GET /api/clients
router.get('/', authMiddleware, clientController.list);

// GET /api/clients/:id
router.get('/:id', authMiddleware, clientController.get);

// POST /api/clients
router.post('/', authMiddleware, clientController.create);

// PUT /api/clients/:id
router.put('/:id', authMiddleware, clientController.update);

// DELETE /api/clients/:id
router.delete('/:id', authMiddleware, clientController.remove);

export default router;
