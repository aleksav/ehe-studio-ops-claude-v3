import { ProjectStatus, Prisma } from '@prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';

export function findAllProjects(where: Record<string, unknown>) {
  return prisma.project.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { tasks: true, milestones: true, time_entries: true } },
    },
    orderBy: { updated_at: 'desc' },
  });
}

export function findProjectById(id: string, tx?: TransactionClient) {
  const client = tx ?? prisma;
  return client.project.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true } } },
  });
}

export function findProjectByIdWithBudgetSummary(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      milestones: { orderBy: { due_date: { sort: 'asc', nulls: 'last' } } },
      _count: { select: { tasks: true, time_entries: true } },
      time_entries: {
        select: {
          hours_worked: true,
          task_type: true,
        },
      },
    },
  });
}

export function createProject(tx: TransactionClient, data: Prisma.ProjectCreateInput) {
  return tx.project.create({ data });
}

export function updateProject(tx: TransactionClient, id: string, data: Record<string, unknown>) {
  return tx.project.update({ where: { id }, data });
}

export function archiveProject(tx: TransactionClient, id: string) {
  return tx.project.update({
    where: { id },
    data: { status: ProjectStatus.ARCHIVED },
  });
}
