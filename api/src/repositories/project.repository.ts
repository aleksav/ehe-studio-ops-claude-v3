import { ProjectStatus, Prisma } from '@prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';

export interface PaginationOpts {
  page: number;
  perPage: number;
}

export async function findAllProjects(where: Record<string, unknown>, pagination?: PaginationOpts) {
  const page = pagination?.page ?? 1;
  const perPage = pagination?.perPage ?? 50;

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { tasks: true, milestones: true, time_entries: true } },
      },
      orderBy: { updated_at: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.project.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  };
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
