import { Prisma } from '@prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';

export function findMilestonesByProjectId(projectId: string) {
  return prisma.milestone.findMany({
    where: { project_id: projectId },
    orderBy: { due_date: { sort: 'asc', nulls: 'last' } },
  });
}

/**
 * Compute the set of overdue milestone IDs for a project.
 *
 * A milestone is overdue when:
 *   - due_date < today
 *   - at least one task in the milestone has status TODO or IN_PROGRESS
 */
export async function findOverdueMilestoneIds(projectId: string): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT m.id
    FROM milestones m
    WHERE m.project_id = ${projectId}
      AND m.due_date < CURRENT_DATE
      AND EXISTS (
        SELECT 1
        FROM tasks t
        WHERE t.milestone_id = m.id
          AND t.status IN ('TODO', 'IN_PROGRESS')
      )
  `);

  return new Set(rows.map((r) => r.id));
}

export function findMilestoneByIdAndProject(id: string, projectId: string, tx?: TransactionClient) {
  const client = tx ?? prisma;
  return client.milestone.findFirst({
    where: { id, project_id: projectId },
  });
}

export function createMilestone(tx: TransactionClient, data: Prisma.MilestoneUncheckedCreateInput) {
  return tx.milestone.create({ data });
}

export function updateMilestone(tx: TransactionClient, id: string, data: Record<string, unknown>) {
  return tx.milestone.update({ where: { id }, data });
}

export function deleteMilestone(tx: TransactionClient, id: string) {
  return tx.milestone.delete({ where: { id } });
}
