import { Router, Response } from 'express';
import { z } from 'zod';
import { AuditAction, TaskType } from '@prisma/client';
import prisma from '../utils/prisma';
import { TransactionClient } from '../utils/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from '../services/audit.service';

const router = Router();

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

/**
 * Validate that rates for a given task_type have no gaps or overlaps.
 * Checks all rates for the task_type, optionally excluding a specific rate ID
 * and optionally including an updated/new rate.
 */
async function validateRateTimeline(
  tx: TransactionClient,
  taskType: TaskType,
  opts?: {
    excludeId?: string;
    includeRate?: { effective_from: Date; effective_to: Date | null };
  },
): Promise<{ valid: boolean; errorCode?: string }> {
  const existingRates = await tx.taskRate.findMany({
    where: {
      task_type: taskType,
      ...(opts?.excludeId ? { id: { not: opts.excludeId } } : {}),
    },
    orderBy: { effective_from: 'asc' },
  });

  const rates = [...existingRates.map((r) => ({
    effective_from: r.effective_from,
    effective_to: r.effective_to,
  }))];

  if (opts?.includeRate) {
    rates.push(opts.includeRate);
  }

  // Sort by effective_from
  rates.sort((a, b) => a.effective_from.getTime() - b.effective_from.getTime());

  if (rates.length < 2) return { valid: true };

  for (let i = 0; i < rates.length - 1; i++) {
    const current = rates[i];
    const next = rates[i + 1];

    if (current.effective_to === null) {
      // Open-ended rate followed by another rate — overlap
      return { valid: false, errorCode: 'TASK_RATE_OVERLAP' };
    }

    const currentEnd = current.effective_to.getTime();
    const nextStart = next.effective_from.getTime();

    // Calculate one day in ms
    const oneDay = 86400000;

    if (currentEnd >= nextStart) {
      return { valid: false, errorCode: 'TASK_RATE_OVERLAP' };
    }

    if (nextStart - currentEnd > oneDay) {
      return { valid: false, errorCode: 'TASK_RATE_GAP' };
    }
  }

  return { valid: true };
}

// GET /api/task-rates
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { task_type } = req.query;
    const where: Record<string, unknown> = {};

    if (task_type && typeof task_type === 'string') {
      where.task_type = task_type as TaskType;
    }

    const taskRates = await prisma.taskRate.findMany({
      where,
      orderBy: [{ task_type: 'asc' }, { effective_from: 'asc' }],
    });

    res.json(taskRates);
  } catch (error) {
    console.error('List task rates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/task-rates/current
router.get('/current', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskRates = await prisma.taskRate.findMany({
      where: { effective_to: null },
      orderBy: { task_type: 'asc' },
    });

    res.json(taskRates);
  } catch (error) {
    console.error('List current task rates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/task-rates
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createTaskRateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const effectiveFrom = new Date(parsed.data.effective_from);
    const effectiveTo = parsed.data.effective_to ? new Date(parsed.data.effective_to) : null;

    const taskRate = await prisma.$transaction(async (tx) => {
      // Auto-close previous open-ended rate for this task_type
      const openRate = await tx.taskRate.findFirst({
        where: {
          task_type: parsed.data.task_type,
          effective_to: null,
        },
      });

      if (openRate) {
        // Close the previous rate the day before the new rate starts
        const closeDate = new Date(effectiveFrom);
        closeDate.setDate(closeDate.getDate() - 1);

        if (closeDate < openRate.effective_from) {
          // The new rate starts before or on the same day as the open rate
          throw { statusCode: 422, errorCode: 'TASK_RATE_OVERLAP' };
        }

        await tx.taskRate.update({
          where: { id: openRate.id },
          data: { effective_to: closeDate },
        });

        await writeAudit(tx, {
          entityType: 'TaskRate',
          entityId: openRate.id,
          action: AuditAction.UPDATE,
          actorId,
          changedFields: {
            effective_to: { before: null, after: closeDate.toISOString() },
          },
        });
      }

      // Validate timeline after auto-close
      const validation = await validateRateTimeline(tx, parsed.data.task_type, {
        includeRate: { effective_from: effectiveFrom, effective_to: effectiveTo },
      });

      if (!validation.valid) {
        throw { statusCode: 422, errorCode: validation.errorCode };
      }

      const created = await tx.taskRate.create({
        data: {
          task_type: parsed.data.task_type,
          day_rate: parsed.data.day_rate,
          currency_code: parsed.data.currency_code ?? 'GBP',
          effective_from: effectiveFrom,
          effective_to: effectiveTo,
        },
      });

      await writeAudit(tx, {
        entityType: 'TaskRate',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId,
        changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
      });

      return created;
    });

    res.status(201).json(taskRate);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; errorCode?: string };
    if (err?.statusCode === 422) {
      res.status(422).json({ error: err.errorCode });
      return;
    }
    console.error('Create task rate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/task-rates/:id
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = updateTaskRateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;

    const taskRate = await prisma.$transaction(async (tx) => {
      const existing = await tx.taskRate.findUnique({ where: { id: req.params.id } });
      if (!existing) return null;

      const data: Record<string, unknown> = {};
      if (parsed.data.day_rate !== undefined) data.day_rate = parsed.data.day_rate;
      if (parsed.data.currency_code !== undefined) data.currency_code = parsed.data.currency_code;
      if (parsed.data.effective_from !== undefined) data.effective_from = new Date(parsed.data.effective_from);
      if (parsed.data.effective_to !== undefined) {
        data.effective_to = parsed.data.effective_to ? new Date(parsed.data.effective_to) : null;
      }

      // Validate timeline with the updated values
      const newFrom = (data.effective_from as Date) ?? existing.effective_from;
      const newTo = data.effective_to !== undefined
        ? (data.effective_to as Date | null)
        : existing.effective_to;

      const validation = await validateRateTimeline(tx, existing.task_type, {
        excludeId: existing.id,
        includeRate: { effective_from: newFrom, effective_to: newTo },
      });

      if (!validation.valid) {
        throw { statusCode: 422, errorCode: validation.errorCode };
      }

      const updated = await tx.taskRate.update({
        where: { id: req.params.id },
        data,
      });

      const changedFields = buildUpdateAuditFields(
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
      );

      if (changedFields) {
        await writeAudit(tx, {
          entityType: 'TaskRate',
          entityId: updated.id,
          action: AuditAction.UPDATE,
          actorId,
          changedFields,
        });
      }

      return updated;
    });

    if (!taskRate) {
      res.status(404).json({ error: 'Task rate not found' });
      return;
    }

    res.json(taskRate);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; errorCode?: string };
    if (err?.statusCode === 422) {
      res.status(422).json({ error: err.errorCode });
      return;
    }
    console.error('Update task rate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/task-rates/:id
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actorId = req.user?.teamMemberId ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.taskRate.findUnique({ where: { id: req.params.id } });
      if (!existing) return null;

      // Check if deleting this rate would create a gap
      const validation = await validateRateTimeline(tx, existing.task_type, {
        excludeId: existing.id,
      });

      if (!validation.valid) {
        throw { statusCode: 422, errorCode: 'TASK_RATE_DELETE_WOULD_GAP' };
      }

      await tx.taskRate.delete({ where: { id: req.params.id } });

      await writeAudit(tx, {
        entityType: 'TaskRate',
        entityId: req.params.id,
        action: AuditAction.DELETE,
        actorId,
        changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
      });

      return existing;
    });

    if (!result) {
      res.status(404).json({ error: 'Task rate not found' });
      return;
    }

    res.json({ message: 'Task rate deleted' });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; errorCode?: string };
    if (err?.statusCode === 422) {
      res.status(422).json({ error: err.errorCode });
      return;
    }
    console.error('Delete task rate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
