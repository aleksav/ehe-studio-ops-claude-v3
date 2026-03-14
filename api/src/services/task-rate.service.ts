import { AuditAction, TaskType } from '../generated/prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';
import {
  findAllTaskRates,
  findCurrentTaskRates,
  findTaskRateById,
  findTaskRatesByType,
  findOpenRateByType,
  createTaskRate as repoCreate,
  updateTaskRate as repoUpdate,
  deleteTaskRate as repoDelete,
} from '../repositories/task-rate.repository';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from './audit.service';

export class TaskRateValidationError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(errorCode: string) {
    super(errorCode);
    this.statusCode = 422;
    this.errorCode = errorCode;
  }
}

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
  const existingRates = await findTaskRatesByType(tx, taskType, opts?.excludeId);

  const rates = [
    ...existingRates.map((r) => ({
      effective_from: r.effective_from,
      effective_to: r.effective_to,
    })),
  ];

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

export async function listTaskRates(taskType?: string) {
  const where: Record<string, unknown> = {};
  if (taskType) {
    where.task_type = taskType as TaskType;
  }
  return findAllTaskRates(where);
}

export async function getCurrentTaskRates() {
  return findCurrentTaskRates();
}

export async function createTaskRateService(
  data: {
    task_type: TaskType;
    day_rate: number;
    currency_code?: string;
    effective_from: string;
    effective_to?: string | null;
  },
  actorId: string | null,
) {
  const effectiveFrom = new Date(data.effective_from);
  const effectiveTo = data.effective_to ? new Date(data.effective_to) : null;

  return prisma.$transaction(async (tx) => {
    // Auto-close previous open-ended rate for this task_type
    const openRate = await findOpenRateByType(tx, data.task_type);

    if (openRate) {
      // Close the previous rate the day before the new rate starts
      const closeDate = new Date(effectiveFrom);
      closeDate.setDate(closeDate.getDate() - 1);

      if (closeDate < openRate.effective_from) {
        // The new rate starts before or on the same day as the open rate
        throw new TaskRateValidationError('TASK_RATE_OVERLAP');
      }

      await repoUpdate(tx, openRate.id, { effective_to: closeDate });

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
    const validation = await validateRateTimeline(tx, data.task_type, {
      includeRate: { effective_from: effectiveFrom, effective_to: effectiveTo },
    });

    if (!validation.valid) {
      throw new TaskRateValidationError(validation.errorCode!);
    }

    const created = await repoCreate(tx, {
      task_type: data.task_type,
      day_rate: data.day_rate,
      currency_code: data.currency_code ?? 'GBP',
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
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
}

export async function updateTaskRateService(
  id: string,
  data: {
    day_rate?: number;
    currency_code?: string;
    effective_from?: string;
    effective_to?: string | null;
  },
  actorId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await findTaskRateById(id, tx);
    if (!existing) return null;

    const updateData: Record<string, unknown> = {};
    if (data.day_rate !== undefined) updateData.day_rate = data.day_rate;
    if (data.currency_code !== undefined) updateData.currency_code = data.currency_code;
    if (data.effective_from !== undefined)
      updateData.effective_from = new Date(data.effective_from);
    if (data.effective_to !== undefined) {
      updateData.effective_to = data.effective_to ? new Date(data.effective_to) : null;
    }

    // Validate timeline with the updated values
    const newFrom = (updateData.effective_from as Date) ?? existing.effective_from;
    const newTo =
      updateData.effective_to !== undefined
        ? (updateData.effective_to as Date | null)
        : existing.effective_to;

    const validation = await validateRateTimeline(tx, existing.task_type, {
      excludeId: existing.id,
      includeRate: { effective_from: newFrom, effective_to: newTo },
    });

    if (!validation.valid) {
      throw new TaskRateValidationError(validation.errorCode!);
    }

    const updated = await repoUpdate(tx, id, updateData);

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
}

export async function deleteTaskRateService(id: string, actorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const existing = await findTaskRateById(id, tx);
    if (!existing) return null;

    // Check if deleting this rate would create a gap
    const validation = await validateRateTimeline(tx, existing.task_type, {
      excludeId: existing.id,
    });

    if (!validation.valid) {
      throw new TaskRateValidationError('TASK_RATE_DELETE_WOULD_GAP');
    }

    await repoDelete(tx, id);

    await writeAudit(tx, {
      entityType: 'TaskRate',
      entityId: id,
      action: AuditAction.DELETE,
      actorId,
      changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
    });

    return existing;
  });
}
