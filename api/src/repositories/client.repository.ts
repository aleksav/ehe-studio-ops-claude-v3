import { Prisma } from '@prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';

export async function findAllClients(page = 1, perPage = 50) {
  const [data, total] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { projects: true } } },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.client.count(),
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
