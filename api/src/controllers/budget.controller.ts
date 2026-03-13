import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getProjectBudgetSummary } from '../services/budget.service';

export async function getBudget(req: AuthenticatedRequest, res: Response) {
  try {
    const budget = await getProjectBudgetSummary(req.params.id);

    if (!budget) {
      res.status(404).json({ error: 'Project not found or has no budget' });
      return;
    }

    res.json(budget);
  } catch (error) {
    console.error('Get project budget error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
