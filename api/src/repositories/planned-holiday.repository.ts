import { Prisma } from '../generated/prisma/client';
import prisma, { TransactionClient } from '../utils/prisma';

export function findHolidaysByTeamMember(teamMemberId: string, year?: number) {
  const where: Prisma.PlannedHolidayWhereInput = { team_member_id: teamMemberId };
  if (year) {
    where.date = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31`),
    };
  }
  return prisma.plannedHoliday.findMany({
    where,
    orderBy: { date: 'asc' },
  });
}

export function findHolidaysByYear(year: number) {
  return prisma.plannedHoliday.findMany({
    where: {
      date: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      },
    },
    orderBy: { date: 'asc' },
  });
}

export function findHolidayById(id: string, tx?: TransactionClient) {
  const client = tx ?? prisma;
  return client.plannedHoliday.findUnique({ where: { id } });
}

export function createPlannedHoliday(
  tx: TransactionClient,
  data: Prisma.PlannedHolidayCreateInput,
) {
  return tx.plannedHoliday.create({ data });
}

export function updatePlannedHoliday(
  tx: TransactionClient,
  id: string,
  data: Record<string, unknown>,
) {
  return tx.plannedHoliday.update({ where: { id }, data });
}

export function deletePlannedHoliday(tx: TransactionClient, id: string) {
  return tx.plannedHoliday.delete({ where: { id } });
}
