import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  listMilestones,
  getMilestone,
  createMilestoneService,
  updateMilestoneService,
  deleteMilestoneService,
} from '../services/milestone.service';
import { z } from 'zod';

const createMilestoneSchema = z.object({
  name: z.string().min(1),
  due_date: z.string().optional(),
});

const updateMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  due_date: z.string().nullable().optional(),
});

export async function list(req: AuthenticatedRequest, res: Response) {
  try {
    const { projectId } = req.params;
    const milestones = await listMilestones(projectId);

    if (milestones === null) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(milestones);
  } catch (error) {
    console.error('List milestones error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function get(req: AuthenticatedRequest, res: Response) {
  try {
    const { projectId, id } = req.params;
    const milestone = await getMilestone(projectId, id);

    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }

    res.json(milestone);
  } catch (error) {
    console.error('Get milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createMilestoneSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { projectId } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const result = await createMilestoneService(projectId, parsed.data, actorId);

    if (result && typeof result === 'object' && 'notFound' in result) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Create milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = updateMilestoneSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { projectId, id } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const milestone = await updateMilestoneService(projectId, id, parsed.data, actorId);

    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }

    res.json(milestone);
  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  try {
    const { projectId, id } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const milestone = await deleteMilestoneService(projectId, id, actorId);

    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }

    res.json({ message: 'Milestone deleted' });
  } catch (error) {
    console.error('Delete milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
