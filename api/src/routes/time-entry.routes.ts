import { Router, Response } from 'express';
import { z } from 'zod';
import { AuditAction, TaskType } from '@prisma/client';
import prisma from '../utils/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from '../services/audit.service';
import { validateDailyHours } from '../services/time-entry.service';

const router = Router();

const timeEntrySchema = z.object({
  project_id: z.string().uuid(),
  team_member_id: z.string().uuid(),
  date: z.string().refine((val) => {
    const date = new Date(val);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date <= today;
  }, 'Date cannot be in the future'),
  hours_worked: z.number().positive('Hours must be greater than 0'),
  task_type: z.nativeEnum(TaskType),
  notes: z.string().optional(),
});

/**
 * Parse an ISO week string (e.g., "2024-W23") into Monday-Sunday date range.
 */
function parseISOWeek(weekStr: string): { start: Date; end: Date } | null {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  if (week < 1 || week > 53) return null;

  // ISO 8601: Week 1 contains January 4th (or the first Thursday of the year)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Convert Sunday=0 to 7
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1) + (week - 1) * 7);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return { start: monday, end: sunday };
}

// GET /api/time-entries
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { project_id, team_member_id, date_from, date_to, week } = req.query;
    const where: Record<string, unknown> = {};

    if (project_id) {
      where.project_id = project_id as string;
    }

    if (team_member_id) {
      where.team_member_id = team_member_id as string;
    }

    // Week filter takes precedence over date_from/date_to
    if (week) {
      const range = parseISOWeek(week as string);
      if (!range) {
        res.status(400).json({ error: 'Invalid week format. Expected ISO week like 2024-W23' });
        return;
      }
      where.date = { gte: range.start, lte: range.end };
    } else {
      if (date_from || date_to) {
        const dateFilter: Record<string, Date> = {};
        if (date_from) dateFilter.gte = new Date(date_from as string);
        if (date_to) dateFilter.lte = new Date(date_to as string);
        where.date = dateFilter;
      }
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: true,
        team_member: true,
      },
      orderBy: { date: 'desc' },
    });

    res.json(entries);
  } catch (error) {
    console.error('List time entries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/time-entries
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = timeEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { date: dateStr, hours_worked, task_type, ...rest } = parsed.data;
    const date = new Date(dateStr);

    // Daily cap validation
    const validation = await validateDailyHours(rest.team_member_id, date, hours_worked);
    if (validation.blocked) {
      res.status(422).json({
        error: 'DAILY_HOURS_EXCEEDED',
        message: `Daily total would be ${validation.newTotal}h (maximum 12h)`,
      });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.timeEntry.create({
        data: {
          ...rest,
          date,
          hours_worked,
          task_type,
        },
        include: {
          project: true,
          team_member: true,
        },
      });

      // Update preferred_task_type if it differs
      if (created.team_member.preferred_task_type !== task_type) {
        await tx.teamMember.update({
          where: { id: rest.team_member_id },
          data: { preferred_task_type: task_type },
        });
      }

      await writeAudit(tx, {
        entityType: 'TimeEntry',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId,
        changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
      });

      return created;
    });

    const meta: Record<string, string> = {};
    if (validation.warning) {
      meta.warning = validation.warning;
    }

    res.status(201).json({
      ...entry,
      ...(Object.keys(meta).length > 0 ? { meta } : {}),
    });
  } catch (error) {
    console.error('Create time entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/time-entries/:id
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = timeEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { date: dateStr, hours_worked, task_type, ...rest } = parsed.data;
    const date = new Date(dateStr);

    // Daily cap validation, excluding current entry
    const validation = await validateDailyHours(
      rest.team_member_id,
      date,
      hours_worked,
      req.params.id,
    );
    if (validation.blocked) {
      res.status(422).json({
        error: 'DAILY_HOURS_EXCEEDED',
        message: `Daily total would be ${validation.newTotal}h (maximum 12h)`,
      });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;

    const entry = await prisma.$transaction(async (tx) => {
      const existing = await tx.timeEntry.findUnique({
        where: { id: req.params.id },
        include: { team_member: true },
      });
      if (!existing) return null;

      const updated = await tx.timeEntry.update({
        where: { id: req.params.id },
        data: {
          ...rest,
          date,
          hours_worked,
          task_type,
        },
        include: {
          project: true,
          team_member: true,
        },
      });

      // Update preferred_task_type if it differs
      if (updated.team_member.preferred_task_type !== task_type) {
        await tx.teamMember.update({
          where: { id: rest.team_member_id },
          data: { preferred_task_type: task_type },
        });
      }

      const changedFields = buildUpdateAuditFields(
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
      );

      if (changedFields) {
        await writeAudit(tx, {
          entityType: 'TimeEntry',
          entityId: updated.id,
          action: AuditAction.UPDATE,
          actorId,
          changedFields,
        });
      }

      return updated;
    });

    if (!entry) {
      res.status(404).json({ error: 'Time entry not found' });
      return;
    }

    const meta: Record<string, string> = {};
    if (validation.warning) {
      meta.warning = validation.warning;
    }

    res.json({
      ...entry,
      ...(Object.keys(meta).length > 0 ? { meta } : {}),
    });
  } catch (error) {
    console.error('Update time entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/time-entries/:id
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actorId = req.user?.teamMemberId ?? null;

    const entry = await prisma.$transaction(async (tx) => {
      const existing = await tx.timeEntry.findUnique({ where: { id: req.params.id } });
      if (!existing) return null;

      await tx.timeEntry.delete({ where: { id: req.params.id } });

      await writeAudit(tx, {
        entityType: 'TimeEntry',
        entityId: existing.id,
        action: AuditAction.DELETE,
        actorId,
        changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
      });

      return existing;
    });

    if (!entry) {
      res.status(404).json({ error: 'Time entry not found' });
      return;
    }

    res.json(entry);
  } catch (error) {
    console.error('Delete time entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
