import { AuditAction, OfficeEventType, Prisma } from '../generated/prisma/client';
import prisma from '../utils/prisma';
import {
  findAllOfficeEvents,
  findOfficeEventById,
  createOfficeEvent as repoCreate,
  updateOfficeEvent as repoUpdate,
  deleteOfficeEvent as repoDelete,
} from '../repositories/office-event.repository';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from './audit.service';

export { findAllOfficeEvents as listOfficeEvents };

export async function getOfficeEvent(id: string) {
  return findOfficeEventById(id);
}

export async function createOfficeEventService(
  data: {
    name: string;
    event_type: OfficeEventType;
    start_date: string;
    end_date: string;
    allow_time_entry: boolean;
    notes?: string | null;
  },
  actorId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const created = await repoCreate(tx, {
      name: data.name,
      event_type: data.event_type,
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
      allow_time_entry: data.allow_time_entry,
      notes: data.notes ?? null,
    } as Prisma.OfficeEventCreateInput);

    await writeAudit(tx, {
      entityType: 'OfficeEvent',
      entityId: created.id,
      action: AuditAction.CREATE,
      actorId,
      changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
    });

    return created;
  });
}

export async function updateOfficeEventService(
  id: string,
  data: {
    name?: string;
    event_type?: OfficeEventType;
    start_date?: string;
    end_date?: string;
    allow_time_entry?: boolean;
    notes?: string | null;
  },
  actorId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await findOfficeEventById(id, tx);
    if (!existing) return null;

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.event_type !== undefined) updateData.event_type = data.event_type;
    if (data.start_date !== undefined) updateData.start_date = new Date(data.start_date);
    if (data.end_date !== undefined) updateData.end_date = new Date(data.end_date);
    if (data.allow_time_entry !== undefined) updateData.allow_time_entry = data.allow_time_entry;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await repoUpdate(tx, id, updateData);

    const changedFields = buildUpdateAuditFields(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    if (changedFields) {
      await writeAudit(tx, {
        entityType: 'OfficeEvent',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        actorId,
        changedFields,
      });
    }

    return updated;
  });
}

export async function deleteOfficeEventService(id: string, actorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const existing = await findOfficeEventById(id, tx);
    if (!existing) return null;

    await repoDelete(tx, id);

    await writeAudit(tx, {
      entityType: 'OfficeEvent',
      entityId: id,
      action: AuditAction.DELETE,
      actorId,
      changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
    });

    return existing;
  });
}
