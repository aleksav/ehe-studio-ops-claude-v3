import { Response } from 'express';
import { z } from 'zod';
import { TaskStatus } from '../generated/prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  listTasks,
  getTask,
  createNewTask,
  updateExistingTask,
  deleteExistingTask,
} from '../services/task.service';

const createTaskSchema = z.object({
  description: z.string().min(1),
  milestone_id: z.string().uuid().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
});

const updateTaskSchema = z.object({
  description: z.string().min(1).optional(),
  milestone_id: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
});

export async function listTasksHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { projectId } = req.params;
    const { status, milestone_id, include_cancelled } = req.query;

    const result = await listTasks({
      project_id: projectId,
      status: status && typeof status === 'string' ? (status as TaskStatus) : undefined,
      milestone_id: milestone_id && typeof milestone_id === 'string' ? milestone_id : undefined,
      include_cancelled: include_cancelled === 'true',
    });

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json(result.data);
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getTaskHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { projectId, id } = req.params;

    const result = await getTask(projectId, id);

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json(result.data);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createTaskHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { projectId } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const result = await createNewTask(projectId, parsed.data, actorId);

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.status(201).json(result.data);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateTaskHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { projectId, id } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const result = await updateExistingTask(projectId, id, parsed.data, actorId);

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json(result.data);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteTaskHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { projectId, id } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const result = await deleteExistingTask(projectId, id, actorId);

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
