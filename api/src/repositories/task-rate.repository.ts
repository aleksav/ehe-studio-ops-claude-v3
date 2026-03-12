import { TaskType } from '@prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';

export function findAllTaskRates(where: Record<string, unknown>) {
  return prisma.taskRate.findMany({
    where,
    orderBy: [{ task_type: 'asc' }, { effective_from: 'asc' }],
  });
}

export function findCurrentTaskRates() {
  return prisma.taskRate.findMany({
    where: { effective_to: null },
    orderBy: { task_type: 'asc' },
  });
}

export function findTaskRateById(id: string, tx?: TransactionClient) {
  const client = tx ?? prisma;
  return client.taskRate.findUnique({ where: { id } });
}

export function findTaskRatesByType(tx: TransactionClient, taskType: TaskType, excludeId?: string) {
  return tx.taskRate.findMany({
    where: {
      task_type: taskType,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { effective_from: 'asc' },
  });
}

export function findOpenRateByType(tx: TransactionClient, taskType: TaskType) {
  return tx.taskRate.findFirst({
    where: {
      task_type: taskType,
      effective_to: null,
    },
  });
}

export function createTaskRate(
  tx: TransactionClient,
  data: {
    task_type: TaskType;
    day_rate: number;
    currency_code: string;
    effective_from: Date;
    effective_to: Date | null;
  },
) {
  return tx.taskRate.create({ data });
}

export function updateTaskRate(tx: TransactionClient, id: string, data: Record<string, unknown>) {
  return tx.taskRate.update({ where: { id }, data });
}

export function deleteTaskRate(tx: TransactionClient, id: string) {
  return tx.taskRate.delete({ where: { id } });
}
