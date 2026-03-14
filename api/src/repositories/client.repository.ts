import { Prisma } from '../generated/prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';

export function findAllClients() {
  return prisma.client.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { projects: true } } },
  });
}

export function findClientById(id: string, tx?: TransactionClient) {
  const client = tx ?? prisma;
  return client.client.findUnique({ where: { id } });
}

export function createClient(tx: TransactionClient, data: Prisma.ClientCreateInput) {
  return tx.client.create({ data });
}

export function updateClient(tx: TransactionClient, id: string, data: Record<string, unknown>) {
  return tx.client.update({ where: { id }, data });
}

export function deleteClient(tx: TransactionClient, id: string) {
  return tx.client.delete({ where: { id } });
}
