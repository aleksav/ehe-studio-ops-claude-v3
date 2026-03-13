import { Prisma, TaskStatus } from '@prisma/client';
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

  return prisma.task.findMany({ where });
}

/**
 * Compute the set of stale task IDs for a project.
 *
 * A task is stale when:
 *   - status is TODO or IN_PROGRESS
 *   - it has at least one assignee
 *   - none of the assigned team members have a time entry on the project
 *     within the last 5 working days (weekends excluded)
 *
 * The cutoff date is computed in SQL by walking backwards from today,
 * skipping Saturdays (dow=6) and Sundays (dow=0).
 */
export async function findStaleTaskIds(projectId: string): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH RECURSIVE working_days AS (
      SELECT CURRENT_DATE - INTERVAL '1 day' AS d, 1 AS cnt
      WHERE EXTRACT(DOW FROM CURRENT_DATE - INTERVAL '1 day') NOT IN (0, 6)
      UNION ALL
      SELECT CURRENT_DATE - INTERVAL '1 day' AS d, 0 AS cnt
      WHERE EXTRACT(DOW FROM CURRENT_DATE - INTERVAL '1 day') IN (0, 6)
      UNION ALL
      SELECT d - INTERVAL '1 day',
             CASE WHEN EXTRACT(DOW FROM d - INTERVAL '1 day') NOT IN (0, 6) THEN cnt + 1 ELSE cnt END
      FROM working_days
      WHERE cnt < 5
    ),
    cutoff AS (
      SELECT MIN(d) AS cutoff_date FROM working_days
    )
    SELECT t.id
    FROM tasks t
    WHERE t.project_id = ${projectId}
      AND t.status IN ('TODO', 'IN_PROGRESS')
      AND EXISTS (
        SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM task_assignments ta
        JOIN time_entries te
          ON te.team_member_id = ta.team_member_id
         AND te.project_id = t.project_id
         AND te.date >= (SELECT cutoff_date FROM cutoff)
        WHERE ta.task_id = t.id
      )
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
