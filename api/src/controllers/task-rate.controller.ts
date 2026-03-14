import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  listTaskRates,
  getCurrentTaskRates,
  createTaskRateService,
  updateTaskRateService,
  deleteTaskRateService,
  TaskRateValidationError,
} from '../services/task-rate.service';
import { z } from 'zod';
import { TaskType } from '../generated/prisma/client';

const createTaskRateSchema = z.object({
  task_type: z.nativeEnum(TaskType),
  day_rate: z.number().positive(),
  currency_code: z.string().length(3).optional(),
  effective_from: z.string(), // ISO date string
  effective_to: z.string().nullable().optional(),
});

const updateTaskRateSchema = z.object({
  day_rate: z.number().positive().optional(),
  currency_code: z.string().length(3).optional(),
  effective_from: z.string().optional(),
  effective_to: z.string().nullable().optional(),
});

export async function list(req: AuthenticatedRequest, res: Response) {
  try {
    const { task_type } = req.query;
    const taskRates = await listTaskRates(
      task_type && typeof task_type === 'string' ? task_type : undefined,
    );
    res.json(taskRates);
  } catch (error) {
    console.error('List task rates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function current(req: AuthenticatedRequest, res: Response) {
  try {
    const taskRates = await getCurrentTaskRates();
    res.json(taskRates);
  } catch (error) {
    console.error('List current task rates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createTaskRateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const taskRate = await createTaskRateService(parsed.data, actorId);

    res.status(201).json(taskRate);
  } catch (error: unknown) {
    if (error instanceof TaskRateValidationError) {
      res.status(422).json({ error: error.errorCode });
      return;
    }
    console.error('Create task rate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = updateTaskRateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const taskRate = await updateTaskRateService(req.params.id, parsed.data, actorId);

    if (!taskRate) {
      res.status(404).json({ error: 'Task rate not found' });
      return;
    }

    res.json(taskRate);
  } catch (error: unknown) {
    if (error instanceof TaskRateValidationError) {
      res.status(422).json({ error: error.errorCode });
      return;
    }
    console.error('Update task rate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.user?.teamMemberId ?? null;
    const result = await deleteTaskRateService(req.params.id, actorId);

    if (!result) {
      res.status(404).json({ error: 'Task rate not found' });
      return;
    }

    res.json({ message: 'Task rate deleted' });
  } catch (error: unknown) {
    if (error instanceof TaskRateValidationError) {
      res.status(422).json({ error: error.errorCode });
      return;
    }
    console.error('Delete task rate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
