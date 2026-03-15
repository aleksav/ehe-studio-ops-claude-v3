import { Prisma } from '../generated/prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';

export function findAllOfficeEvents(year?: number) {
  const where: Prisma.OfficeEventWhereInput = {};
  if (year) {
    // Events that overlap the given year: start_date <= end of year AND end_date >= start of year
    where.start_date = { lte: new Date(`${year}-12-31`) };
    where.end_date = { gte: new Date(`${year}-01-01`) };
  }
  return prisma.officeEvent.findMany({
    where,
    orderBy: { start_date: 'asc' },
  });
}

export function findOfficeEventById(id: string, tx?: TransactionClient) {
  const client = tx ?? prisma;
  return client.officeEvent.findUnique({ where: { id } });
}

export function createOfficeEvent(tx: TransactionClient, data: Prisma.OfficeEventCreateInput) {
  return tx.officeEvent.create({ data });
}

export function updateOfficeEvent(
  tx: TransactionClient,
  id: string,
  data: Record<string, unknown>,
) {
  return tx.officeEvent.update({ where: { id }, data });
}

export function deleteOfficeEvent(tx: TransactionClient, id: string) {
  return tx.officeEvent.delete({ where: { id } });
}
