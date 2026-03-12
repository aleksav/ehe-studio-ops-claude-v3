import { Prisma } from '@prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';

export function findMilestonesByProjectId(projectId: string) {
  return prisma.milestone.findMany({
    where: { project_id: projectId },
    orderBy: { due_date: { sort: 'asc', nulls: 'last' } },
  });
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
