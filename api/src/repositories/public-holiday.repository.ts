import { Prisma } from '../generated/prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';

export function findAllPublicHolidays(year?: number) {
  const where: Prisma.PublicHolidayWhereInput = {};
  if (year) {
    where.date = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31`),
    };
  }
  return prisma.publicHoliday.findMany({
    where,
    orderBy: { date: 'asc' },
  });
}

export function findPublicHolidayById(id: string, tx?: TransactionClient) {
  const client = tx ?? prisma;
  return client.publicHoliday.findUnique({ where: { id } });
}

export function createPublicHoliday(tx: TransactionClient, data: Prisma.PublicHolidayCreateInput) {
  return tx.publicHoliday.create({ data });
}

export function updatePublicHoliday(
  tx: TransactionClient,
  id: string,
  data: Record<string, unknown>,
) {
  return tx.publicHoliday.update({ where: { id }, data });
}

export function deletePublicHoliday(tx: TransactionClient, id: string) {
  return tx.publicHoliday.delete({ where: { id } });
}
