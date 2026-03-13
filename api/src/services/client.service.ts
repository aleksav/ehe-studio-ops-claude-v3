import { AuditAction, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import {
  findAllClients,
  findClientById,
  createClient as repoCreate,
  updateClient as repoUpdate,
  deleteClient as repoDelete,
} from '../repositories/client.repository';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from './audit.service';

export { findAllClients as listClients };

export async function getClient(id: string) {
  return findClientById(id);
}

export async function createClientService(
  data: { name: string; contact_name?: string; contact_email?: string },
  actorId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const created = await repoCreate(tx, data as Prisma.ClientCreateInput);

    await writeAudit(tx, {
      entityType: 'Client',
      entityId: created.id,
      action: AuditAction.CREATE,
      actorId,
      changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
    });

    return created;
  });
}

export async function updateClientService(
  id: string,
  data: { name?: string; contact_name?: string | null; contact_email?: string | null },
  actorId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await findClientById(id, tx);
    if (!existing) return null;

    const updated = await repoUpdate(tx, id, data);

    const changedFields = buildUpdateAuditFields(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    if (changedFields) {
      await writeAudit(tx, {
        entityType: 'Client',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        actorId,
        changedFields,
      });
    }

    return updated;
  });
}

export async function deleteClientService(id: string, actorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const existing = await findClientById(id, tx);
    if (!existing) return null;

    // Explicitly unlink projects before deleting to avoid FK issues
    await tx.project.updateMany({
      where: { client_id: id },
      data: { client_id: null },
    });

    await repoDelete(tx, id);

    await writeAudit(tx, {
      entityType: 'Client',
      entityId: id,
      action: AuditAction.DELETE,
      actorId,
      changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
    });

    return existing;
  });
}
