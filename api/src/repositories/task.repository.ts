import { Prisma, TaskStatus } from '../generated/prisma/client';
import prisma from '../utils/prisma';
import { TransactionClient } from '../utils/prisma';

export interface TaskCreateData {
  description: string;
  project_id: string;
  milestone_id: string | null;
  status: TaskStatus;
  started_at?: Date;
  completed_at?: Date;
}

export interface TaskUpdateData {
  description?: string;
  milestone_id?: string | null;
  status?: TaskStatus;
  started_at?: Date | null;
  completed_at?: Date | null;
}

export interface TaskListFilters {
  project_id: string;
  status?: TaskStatus;
  milestone_id?: string;
  include_cancelled?: boolean;
}

export async function findProjectById(projectId: string) {
  return prisma.project.findUnique({ where: { id: projectId } });
}

export async function findTasksByProject(filters: TaskListFilters) {
  const where: Record<string, unknown> = { project_id: filters.project_id };

  if (filters.status) {
    where.status = filters.status;
  } else if (!filters.include_cancelled) {
    where.status = { not: TaskStatus.CANCELLED };
  }

  if (filters.milestone_id) {
    where.milestone_id = filters.milestone_id;
  }

  return prisma.task.findMany({
    where,
    include: {
      assignments: {
        include: { team_member: { select: { id: true, full_name: true, email: true } } },
      },
      milestone: { select: { id: true, name: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Compute the set of stale task IDs for a project.
 *
 * A task is stale when:
 *   - status is IN_PROGRESS
 *   - updated_at is at least 5 days ago (i.e. no status change or edit in 5+ days)
 */
export async function findStaleTaskIds(projectId: string): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT t.id
    FROM tasks t
    WHERE t.project_id = ${projectId}
      AND t.status = 'IN_PROGRESS'
      AND t.updated_at <= NOW() - INTERVAL '5 days'
  `);

  return new Set(rows.map((r) => r.id));
}

export async function findTaskByIdAndProject(id: string, projectId: string) {
  return prisma.task.findFirst({
    where: { id, project_id: projectId },
    include: {
      assignments: {
        include: { team_member: true },
      },
    },
  });
}

export async function findTaskByIdAndProjectTx(
  tx: TransactionClient,
  id: string,
  projectId: string,
) {
  return tx.task.findFirst({
    where: { id, project_id: projectId },
  });
}

export async function createTask(tx: TransactionClient, data: TaskCreateData) {
  return tx.task.create({ data });
}

export async function updateTask(tx: TransactionClient, id: string, data: TaskUpdateData) {
  return tx.task.update({ where: { id }, data });
}

export async function deleteTask(tx: TransactionClient, id: string) {
  return tx.task.delete({ where: { id } });
}
