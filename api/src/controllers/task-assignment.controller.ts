import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  listAssignments,
  assignMember,
  unassignMember,
} from '../services/task-assignment.service';

const createAssignmentSchema = z.object({
  team_member_id: z.string().uuid(),
});

export async function listAssignmentsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { taskId } = req.params;

    const result = await listAssignments(taskId);

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json(result.data);
  } catch (error) {
    console.error('List assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createAssignmentHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { taskId } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const result = await assignMember(taskId, parsed.data.team_member_id, actorId);

    if (result.error === 'Task not found' || result.error === 'Team member not found') {
      res.status(404).json({ error: result.error });
      return;
    }

    if (result.error === 'duplicate') {
      res.status(409).json({ error: 'Team member is already assigned to this task' });
      return;
    }

    res.status(201).json(result.data);
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteAssignmentHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { taskId, teamMemberId } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const result = await unassignMember(taskId, teamMemberId, actorId);

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({ message: 'Assignment removed' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
