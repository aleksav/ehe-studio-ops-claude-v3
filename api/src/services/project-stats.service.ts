import prisma from '../utils/prisma';

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
  budget_hours: number | null;
  hourly_rate: number | null;
  currency_code: string;
  by_task_type: ByTaskType[];
  by_team_member: ByTeamMember[];
  by_month: ByMonth[];
}

export async function getProjectStats(
  projectId: string,
  startDate?: string,
  endDate?: string,
): Promise<ProjectStats | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      budget_hours: true,
      hourly_rate: true,
      currency_code: true,
    },
  });

  if (!project) return null;

  const hourlyRate = project.hourly_rate ? Number(project.hourly_rate) : 0;
  const budgetHours = project.budget_hours ? Number(project.budget_hours) : null;

  // Build date filter
  const dateFilter: Record<string, Date> = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const dateWhere = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

  // Fetch all matching time entries
  const entries = await prisma.timeEntry.findMany({
    where: {
      project_id: projectId,
      ...dateWhere,
    },
    select: {
      hours_worked: true,
      task_type: true,
      team_member_id: true,
      date: true,
      team_member: {
        select: { full_name: true },
      },
    },
  });

  let totalHours = 0;

  const taskTypeMap = new Map<string, number>();
  const memberMap = new Map<string, { name: string; hours: number }>();
  const monthMap = new Map<string, number>();

  for (const entry of entries) {
    const hours = Number(entry.hours_worked);
    totalHours += hours;

    // By task type
    const prev = taskTypeMap.get(entry.task_type) ?? 0;
    taskTypeMap.set(entry.task_type, prev + hours);

    // By team member
    const memberData = memberMap.get(entry.team_member_id) ?? {
      name: entry.team_member.full_name,
      hours: 0,
    };
    memberData.hours += hours;
    memberMap.set(entry.team_member_id, memberData);

    // By month
    const monthKey = entry.date.toISOString().slice(0, 7); // YYYY-MM
    const prevMonth = monthMap.get(monthKey) ?? 0;
    monthMap.set(monthKey, prevMonth + hours);
  }

  const totalCost = Math.round(totalHours * hourlyRate * 100) / 100;

  const byTaskType: ByTaskType[] = Array.from(taskTypeMap.entries()).map(([task_type, hours]) => ({
    task_type,
    hours: Math.round(hours * 100) / 100,
    cost: Math.round(hours * hourlyRate * 100) / 100,
  }));

  const byTeamMember: ByTeamMember[] = Array.from(memberMap.entries()).map(
    ([team_member_id, data]) => ({
      team_member_id,
      name: data.name,
      hours: Math.round(data.hours * 100) / 100,
      cost: Math.round(data.hours * hourlyRate * 100) / 100,
    }),
  );

  const byMonth: ByMonth[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, hours]) => ({
      month,
      hours: Math.round(hours * 100) / 100,
      cost: Math.round(hours * hourlyRate * 100) / 100,
    }));

  return {
    total_hours: Math.round(totalHours * 100) / 100,
    total_cost: totalCost,
    budget_hours: budgetHours,
    hourly_rate: hourlyRate || null,
    currency_code: project.currency_code,
    by_task_type: byTaskType,
    by_team_member: byTeamMember,
    by_month: byMonth,
  };
}
