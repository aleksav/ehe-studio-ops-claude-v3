import { AuditAction, Prisma } from '@prisma/client';
import { TransactionClient } from '../utils/prisma';

interface AuditChangedFields {
  [key: string]: { before: unknown; after: unknown } | { after: unknown } | { before: unknown };
}

export async function writeAudit(
  tx: TransactionClient,
  params: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    actorId: string | null;
    changedFields: AuditChangedFields | null;
  },
) {
  return tx.auditLog.create({
    data: {
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      actor_id: params.actorId,
      changed_fields: params.changedFields === null
        ? Prisma.JsonNull
        : (params.changedFields as unknown as Prisma.InputJsonValue),
    },
  });
}

export function buildCreateAuditFields(entity: Record<string, unknown>): AuditChangedFields {
  return { after: entity } as unknown as AuditChangedFields;
}

export function buildDeleteAuditFields(entity: Record<string, unknown>): AuditChangedFields {
  return { before: entity } as unknown as AuditChangedFields;
}

export function buildUpdateAuditFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AuditChangedFields | null {
  const changes: AuditChangedFields = {};
  let hasChanges = false;

  for (const key of Object.keys(after)) {
    const beforeVal = before[key];
    const afterVal = after[key];
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changes[key] = { before: beforeVal, after: afterVal };
      hasChanges = true;
    }
  }

  return hasChanges ? changes : null;
}
