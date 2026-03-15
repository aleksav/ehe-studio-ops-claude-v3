import { AuditAction, HolidayDayType, Prisma } from '../generated/prisma/client';
import prisma from '../utils/prisma';
import {
  findHolidaysByTeamMember,
  findHolidaysByYear,
  findHolidayById,
  createPlannedHoliday as repoCreate,
  updatePlannedHoliday as repoUpdate,
  deletePlannedHoliday as repoDelete,
} from '../repositories/planned-holiday.repository';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from './audit.service';

const ANNUAL_ALLOWANCE = 26;

export { findHolidaysByTeamMember as listHolidaysByTeamMember };
export { findHolidaysByYear as listHolidaysByYear };

export async function getPlannedHoliday(id: string) {
  return findHolidayById(id);
}

export async function getHolidayAllowance(teamMemberId: string, year: number) {
  const holidays = await findHolidaysByTeamMember(teamMemberId, year);
  let used = 0;
  for (const h of holidays) {
    used += h.day_type === HolidayDayType.FULL ? 1 : 0.5;
  }
  return { total: ANNUAL_ALLOWANCE, used, remaining: ANNUAL_ALLOWANCE - used };
}

export async function createPlannedHolidayService(
  teamMemberId: string,
  data: { date: string; day_type: HolidayDayType; notes?: string },
  actorId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const created = await repoCreate(tx, {
      team_member: { connect: { id: teamMemberId } },
      date: new Date(data.date),
      day_type: data.day_type,
      notes: data.notes ?? null,
    } as Prisma.PlannedHolidayCreateInput);

    await writeAudit(tx, {
      entityType: 'PlannedHoliday',
      entityId: created.id,
      action: AuditAction.CREATE,
      actorId,
      changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
    });

    return created;
  });
}

export async function updatePlannedHolidayService(
  id: string,
  data: { date?: string; day_type?: HolidayDayType; notes?: string | null },
  actorId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await findHolidayById(id, tx);
    if (!existing) return null;

    const updateData: Record<string, unknown> = {};
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.day_type !== undefined) updateData.day_type = data.day_type;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await repoUpdate(tx, id, updateData);

    const changedFields = buildUpdateAuditFields(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    if (changedFields) {
      await writeAudit(tx, {
        entityType: 'PlannedHoliday',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        actorId,
        changedFields,
      });
    }

    return updated;
  });
}

export async function deletePlannedHolidayService(id: string, actorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const existing = await findHolidayById(id, tx);
    if (!existing) return null;

    await repoDelete(tx, id);

    await writeAudit(tx, {
      entityType: 'PlannedHoliday',
      entityId: id,
      action: AuditAction.DELETE,
      actorId,
      changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
    });

    return existing;
  });
}
