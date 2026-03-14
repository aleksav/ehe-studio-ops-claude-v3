import { AuditAction, Prisma } from '../generated/prisma/client';
import prisma from '../utils/prisma';
import {
  findAllPublicHolidays,
  findPublicHolidayById,
  createPublicHoliday as repoCreate,
  updatePublicHoliday as repoUpdate,
  deletePublicHoliday as repoDelete,
} from '../repositories/public-holiday.repository';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from './audit.service';

export { findAllPublicHolidays as listPublicHolidays };

export async function getPublicHoliday(id: string) {
  return findPublicHolidayById(id);
}

export async function createPublicHolidayService(
  data: { date: string; name: string },
  actorId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const created = await repoCreate(tx, {
      date: new Date(data.date),
      name: data.name,
    } as Prisma.PublicHolidayCreateInput);

    await writeAudit(tx, {
      entityType: 'PublicHoliday',
      entityId: created.id,
      action: AuditAction.CREATE,
      actorId,
      changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
    });

    return created;
  });
}

export async function updatePublicHolidayService(
  id: string,
  data: { date?: string; name?: string },
  actorId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await findPublicHolidayById(id, tx);
    if (!existing) return null;

    const updateData: Record<string, unknown> = {};
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.name !== undefined) updateData.name = data.name;

    const updated = await repoUpdate(tx, id, updateData);

    const changedFields = buildUpdateAuditFields(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    if (changedFields) {
      await writeAudit(tx, {
        entityType: 'PublicHoliday',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        actorId,
        changedFields,
      });
    }

    return updated;
  });
}

export async function deletePublicHolidayService(id: string, actorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const existing = await findPublicHolidayById(id, tx);
    if (!existing) return null;

    await repoDelete(tx, id);

    await writeAudit(tx, {
      entityType: 'PublicHoliday',
      entityId: id,
      action: AuditAction.DELETE,
      actorId,
      changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
    });

    return existing;
  });
}
