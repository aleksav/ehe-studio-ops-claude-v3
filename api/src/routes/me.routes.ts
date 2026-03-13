import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Date helpers (no date-fns in api package)
// ---------------------------------------------------------------------------

/** Returns UTC Monday 00:00 of the ISO week containing `date`. */
function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay() || 7; // Convert Sunday=0 to 7
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

/** Returns UTC Sunday 23:59:59.999 of the ISO week containing `date`. */
function getISOWeekEnd(date: Date): Date {
  const start = getISOWeekStart(date);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** Returns a new Date that is `days` days before `date`. */
function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const daysQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => {
      const n = val ? parseInt(val, 10) : 7;
      return Number.isFinite(n) && n > 0 && n <= 90 ? n : 7;
    }),
});

// ---------------------------------------------------------------------------
// GET /api/me/tasks
// Tasks assigned to the current user, with project + client info
// ---------------------------------------------------------------------------
router.get('/tasks', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teamMemberId = req.user?.teamMemberId;
    if (!teamMemberId) {
      res.status(400).json({ error: 'User is not linked to a team member' });
      return;
    }

    const assignments = await prisma.taskAssignment.findMany({
      where: { team_member_id: teamMemberId },
      include: {
        task: {
          include: {
            project: {
              include: {
                client: true,
              },
            },
          },
        },
      },
    });

    // Map to a flat response with task + project + client
    const tasks = assignments.map((a) => ({
      id: a.task.id,
      description: a.task.description,
      status: a.task.status,
      started_at: a.task.started_at,
      completed_at: a.task.completed_at,
      project_id: a.task.project_id,
      project_name: a.task.project.name,
      client_name: a.task.project.client?.name ?? null,
    }));

    res.json(tasks);
  } catch (error) {
    console.error('GET /api/me/tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/me/time-entries?days=7
// Recent time entries for current user
// ---------------------------------------------------------------------------
router.get('/time-entries', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teamMemberId = req.user?.teamMemberId;
    if (!teamMemberId) {
      res.status(400).json({ error: 'User is not linked to a team member' });
      return;
    }

    const parsed = daysQuerySchema.safeParse(req.query);
    const days = parsed.success ? parsed.data.days : 7;

    const since = subtractDays(new Date(), days);

    const entries = await prisma.timeEntry.findMany({
      where: {
        team_member_id: teamMemberId,
        date: { gte: since },
      },
      include: {
        project: {
          include: {
            client: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const result = entries.map((e) => ({
      id: e.id,
      project_id: e.project_id,
      project_name: e.project.name,
      client_name: e.project.client?.name ?? null,
      date: e.date.toISOString().split('T')[0],
      hours_worked: Number(e.hours_worked),
      task_type: e.task_type,
      notes: e.notes,
    }));

    res.json(result);
  } catch (error) {
    console.error('GET /api/me/time-entries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/me/projects
// Projects where user has assignments or time entries, with hours this week
// and budget spend percentage
// ---------------------------------------------------------------------------
router.get('/projects', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teamMemberId = req.user?.teamMemberId;
    if (!teamMemberId) {
      res.status(400).json({ error: 'User is not linked to a team member' });
      return;
    }

    const now = new Date();
    const weekStart = getISOWeekStart(now);
    const weekEnd = getISOWeekEnd(now);

    // Find all project IDs the user has task assignments for
    const assignmentProjectIds = await prisma.taskAssignment.findMany({
      where: { team_member_id: teamMemberId },
      select: {
        task: {
          select: { project_id: true },
        },
      },
    });

    // Find all project IDs the user has time entries for
    const timeEntryProjectIds = await prisma.timeEntry.findMany({
      where: { team_member_id: teamMemberId },
      select: { project_id: true },
      distinct: ['project_id'],
    });

    // Merge unique project IDs
    const projectIdSet = new Set<string>();
    for (const a of assignmentProjectIds) {
      projectIdSet.add(a.task.project_id);
    }
    for (const t of timeEntryProjectIds) {
      projectIdSet.add(t.project_id);
    }

    if (projectIdSet.size === 0) {
      res.json([]);
      return;
    }

    const projectIds = Array.from(projectIdSet);

    // Fetch projects with client info
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      include: { client: true },
    });

    // Fetch this week's time entries for the user across these projects
    const weekEntries = await prisma.timeEntry.findMany({
      where: {
        team_member_id: teamMemberId,
        project_id: { in: projectIds },
        date: { gte: weekStart, lte: weekEnd },
      },
      select: {
        project_id: true,
        hours_worked: true,
      },
    });

    // Sum hours per project this week
    const hoursMap = new Map<string, number>();
    for (const e of weekEntries) {
      const current = hoursMap.get(e.project_id) ?? 0;
      hoursMap.set(e.project_id, current + Number(e.hours_worked));
    }

    // For budget spend %, aggregate spend per project in the database.
    // Join time_entries with the most recent applicable task_rate (DESC by
    // effective_from) so we pick the latest matching rate, not the earliest.
    const spendRows = await prisma.$queryRawUnsafe<
      { project_id: string; total_spend: number }[]
    >(
      `
      SELECT
        te.project_id,
        COALESCE(SUM((te.hours_worked / 8.0) * tr.day_rate), 0)::float AS total_spend
      FROM time_entries te
      INNER JOIN LATERAL (
        SELECT day_rate
        FROM task_rates r
        WHERE r.task_type::text = te.task_type::text
          AND r.effective_from <= te.date
          AND (r.effective_to IS NULL OR r.effective_to >= te.date)
        ORDER BY r.effective_from DESC
        LIMIT 1
      ) tr ON true
      WHERE te.project_id = ANY($1)
      GROUP BY te.project_id
      `,
      projectIds,
    );

    const spendMap = new Map<string, number>();
    for (const row of spendRows) {
      spendMap.set(row.project_id, row.total_spend);
    }

    const result = projects.map((p) => {
      const budgetAmount = p.budget_amount ? Number(p.budget_amount) : null;
      const actualSpend = spendMap.get(p.id) ?? 0;
      const budgetSpendPct =
        budgetAmount && budgetAmount > 0
          ? Math.round((actualSpend / budgetAmount) * 10000) / 100
          : null;

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        client_name: p.client?.name ?? null,
        budget_type: p.budget_type,
        budget_amount: budgetAmount,
        actual_spend: Math.round(actualSpend * 100) / 100,
        budget_spend_pct: budgetSpendPct,
        hours_this_week: Math.round((hoursMap.get(p.id) ?? 0) * 100) / 100,
      };
    });

    // Sort: active first, then by client name, then project name
    result.sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      const ca = a.client_name ?? '';
      const cb = b.client_name ?? '';
      const cmp = ca.localeCompare(cb);
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
    });

    res.json(result);
  } catch (error) {
    console.error('GET /api/me/projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
