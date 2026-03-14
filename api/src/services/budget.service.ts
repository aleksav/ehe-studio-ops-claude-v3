import { BudgetType } from '../generated/prisma/client';
import prisma from '../utils/prisma';

interface AnomalyEntry {
  time_entry_id: string;
  date: string;
  task_type: string;
  hours_worked: number;
}

interface BudgetSummary {
  project_id: string;
  budget_type: string;
  budget_amount: number | null;
  currency_code: string;
  actual_spend: number;
  budget_remaining: number | null;
  hours_logged: number;
  anomalies?: AnomalyEntry[];
}

export async function getProjectBudgetSummary(projectId: string): Promise<BudgetSummary | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      budget_type: true,
      budget_amount: true,
      currency_code: true,
    },
  });

  if (!project) return null;

  if (project.budget_type === BudgetType.NONE) {
    return null;
  }

  // Fetch all time entries for this project
  const timeEntries = await prisma.timeEntry.findMany({
    where: { project_id: projectId },
    select: {
      id: true,
      date: true,
      hours_worked: true,
      task_type: true,
    },
  });

  // Fetch all task rates
  const taskRates = await prisma.taskRate.findMany({
    select: {
      task_type: true,
      day_rate: true,
      effective_from: true,
      effective_to: true,
    },
    orderBy: { effective_from: 'asc' },
  });

  let actualSpend = 0;
  let hoursLogged = 0;
  const anomalies: AnomalyEntry[] = [];

  for (const entry of timeEntries) {
    const hours = Number(entry.hours_worked);
    hoursLogged += hours;

    // Find matching task rate: same task_type and entry date within effective range
    const entryDate = entry.date;
    const matchingRate = taskRates.find((rate) => {
      if (rate.task_type !== entry.task_type) return false;
      if (entryDate < rate.effective_from) return false;
      if (rate.effective_to && entryDate > rate.effective_to) return false;
      return true;
    });

    if (matchingRate) {
      // Cost = hours_worked / 8.0 * day_rate
      const cost = (hours / 8.0) * Number(matchingRate.day_rate);
      actualSpend += cost;
    } else {
      anomalies.push({
        time_entry_id: entry.id,
        date: entry.date.toISOString().split('T')[0],
        task_type: entry.task_type,
        hours_worked: hours,
      });
    }
  }

  const budgetAmount = project.budget_amount ? Number(project.budget_amount) : null;

  const budgetRemaining = budgetAmount !== null ? budgetAmount - actualSpend : null;

  const result: BudgetSummary = {
    project_id: project.id,
    budget_type: project.budget_type,
    budget_amount: budgetAmount,
    currency_code: project.currency_code,
    actual_spend: Math.round(actualSpend * 100) / 100,
    budget_remaining: budgetRemaining !== null ? Math.round(budgetRemaining * 100) / 100 : null,
    hours_logged: Math.round(hoursLogged * 100) / 100,
  };

  if (anomalies.length > 0) {
    result.anomalies = anomalies;
  }

  return result;
}
