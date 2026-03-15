import prisma from '../utils/prisma';
import { TaskType } from '../generated/prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ByTaskType {
  task_type: string;
  hours: number;
  cost: number;
}

interface ByTeamMember {
  team_member_id: string;
  name: string;
  hours: number;
  cost: number;
}

interface ByMonth {
  month: string;
  hours: number;
  cost: number;
}

export interface ProjectStats {
  total_hours: number;
  total_cost: number;
  currency_code: string;
  by_task_type: ByTaskType[];
  by_team_member: ByTeamMember[];
  by_month: ByMonth[];
}

// ---------------------------------------------------------------------------
// Cost calculation — all monetary logic lives here
// ---------------------------------------------------------------------------

interface TaskRateRecord {
  task_type: TaskType;
  day_rate: number;
  effective_from: Date;
  effective_to: Date | null;
}

/**
 * Loads all task rates from the database, ordered so that the most recent
 * effective_from comes first for each task type.
 */
async function loadTaskRates(): Promise<TaskRateRecord[]> {
  const rates = await prisma.taskRate.findMany({
    orderBy: { effective_from: 'desc' },
  });
  return rates.map((r) => ({
    task_type: r.task_type,
    day_rate: Number(r.day_rate),
    effective_from: r.effective_from,
    effective_to: r.effective_to,
  }));
}

/**
 * Returns the daily rate for a given task type on a given date.
 * Assumes a standard 8-hour working day for converting hours → cost.
 */
const HOURS_PER_DAY = 8;

function getDayRate(rates: TaskRateRecord[], taskType: TaskType, date: Date): number {
  for (const r of rates) {
    if (r.task_type !== taskType) continue;
    if (date < r.effective_from) continue;
    if (r.effective_to && date > r.effective_to) continue;
    return r.day_rate;
  }
  return 0; // no matching rate found
}

/**
 * Calculate the cost of a time entry given hours worked, task type and date.
 * Cost = (hours / HOURS_PER_DAY) * day_rate
 */
function calculateEntryCost(
  rates: TaskRateRecord[],
  taskType: TaskType,
  date: Date,
  hours: number,
): number {
  const dayRate = getDayRate(rates, taskType, date);
  return (hours / HOURS_PER_DAY) * dayRate;
}

// ---------------------------------------------------------------------------
// Main stats query
// ---------------------------------------------------------------------------

export async function getProjectStats(
  projectId: string,
  startDate?: string,
  endDate?: string,
): Promise<ProjectStats | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, currency_code: true },
  });

  if (!project) return null;

  // Build date filter
  const dateFilter: Record<string, Date> = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);
  const dateWhere = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

  // Fetch time entries and task rates in parallel
  const [entries, rates] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { project_id: projectId, ...dateWhere },
      select: {
        hours_worked: true,
        task_type: true,
        team_member_id: true,
        date: true,
        team_member: { select: { full_name: true } },
      },
    }),
    loadTaskRates(),
  ]);

  // Aggregate
  let totalHours = 0;
  let totalCost = 0;

  const taskTypeMap = new Map<string, { hours: number; cost: number }>();
  const memberMap = new Map<string, { name: string; hours: number; cost: number }>();
  const monthMap = new Map<string, { hours: number; cost: number }>();

  for (const entry of entries) {
    const hours = Number(entry.hours_worked);
    const cost = calculateEntryCost(rates, entry.task_type, entry.date, hours);

    totalHours += hours;
    totalCost += cost;

    // By task type
    const tt = taskTypeMap.get(entry.task_type) ?? { hours: 0, cost: 0 };
    tt.hours += hours;
    tt.cost += cost;
    taskTypeMap.set(entry.task_type, tt);

    // By team member
    const tm = memberMap.get(entry.team_member_id) ?? {
      name: entry.team_member.full_name,
      hours: 0,
      cost: 0,
    };
    tm.hours += hours;
    tm.cost += cost;
    memberMap.set(entry.team_member_id, tm);

    // By month
    const monthKey = entry.date.toISOString().slice(0, 7);
    const mo = monthMap.get(monthKey) ?? { hours: 0, cost: 0 };
    mo.hours += hours;
    mo.cost += cost;
    monthMap.set(monthKey, mo);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    total_hours: round2(totalHours),
    total_cost: round2(totalCost),
    currency_code: project.currency_code,
    by_task_type: Array.from(taskTypeMap.entries()).map(([task_type, d]) => ({
      task_type,
      hours: round2(d.hours),
      cost: round2(d.cost),
    })),
    by_team_member: Array.from(memberMap.entries()).map(([team_member_id, d]) => ({
      team_member_id,
      name: d.name,
      hours: round2(d.hours),
      cost: round2(d.cost),
    })),
    by_month: Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        hours: round2(d.hours),
        cost: round2(d.cost),
      })),
  };
}
