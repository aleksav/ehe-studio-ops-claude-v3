import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import * as projectController from '../controllers/project.controller';
import * as budgetController from '../controllers/budget.controller';
import { getProjectStats } from '../services/project-stats.service';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/projects
router.get('/', authMiddleware, projectController.list);

// GET /api/projects/:id
router.get('/:id', authMiddleware, projectController.get);

// GET /api/projects/:id/budget
router.get('/:id/budget', authMiddleware, budgetController.getBudget);

// GET /api/projects/:id/stats
router.get('/:id/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    const stats = await getProjectStats(
      req.params.id,
      typeof start_date === 'string' ? start_date : undefined,
      typeof end_date === 'string' ? end_date : undefined,
    );

    if (!stats) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(stats);
  } catch (error) {
    console.error('Project stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/weekly-hours — hours per team member for the current ISO week
router.get(
  '/:id/weekly-hours',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectId = req.params.id;

      // Compute current ISO week boundaries (Monday–Sunday)
      const now = new Date();
      const dayOfWeek = now.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday),
      );
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);

      const entries = await prisma.timeEntry.groupBy({
        by: ['team_member_id'],
        where: {
          project_id: projectId,
          date: { gte: monday, lte: sunday },
        },
        _sum: { hours_worked: true },
      });

      const result: Record<string, number> = {};
      for (const entry of entries) {
        result[entry.team_member_id] = Number(entry._sum.hours_worked ?? 0);
      }

      res.json(result);
    } catch (error) {
      console.error('Weekly hours error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// POST /api/projects
router.post('/', authMiddleware, projectController.create);

// PUT /api/projects/:id
router.put('/:id', authMiddleware, projectController.update);

// DELETE /api/projects/:id — archive
router.delete('/:id', authMiddleware, projectController.archive);

export default router;
