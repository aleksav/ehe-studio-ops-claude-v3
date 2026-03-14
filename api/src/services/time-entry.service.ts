import prisma from '../utils/prisma';
import { Decimal } from '@prisma/client/runtime/client';

export async function getDailyHoursTotal(
  teamMemberId: string,
  date: Date,
  excludeEntryId?: string,
): Promise<number> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const result = await prisma.timeEntry.aggregate({
    where: {
      team_member_id: teamMemberId,
      date: startOfDay,
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
    _sum: {
      hours_worked: true,
    },
  });

  const sum = result._sum.hours_worked;
  return sum ? new Decimal(sum.toString()).toNumber() : 0;
}

export interface DailyHoursValidation {
  currentTotal: number;
  newTotal: number;
  warning: string | null;
  blocked: boolean;
}

export async function validateDailyHours(
  teamMemberId: string,
  date: Date,
  hoursToAdd: number,
  excludeEntryId?: string,
): Promise<DailyHoursValidation> {
  const currentTotal = await getDailyHoursTotal(teamMemberId, date, excludeEntryId);
  const newTotal = currentTotal + hoursToAdd;

  return {
    currentTotal,
    newTotal,
    warning:
      newTotal > 8 && newTotal < 12 ? `Daily total would be ${newTotal}h (exceeds 8h)` : null,
    blocked: newTotal >= 12,
  };
}
