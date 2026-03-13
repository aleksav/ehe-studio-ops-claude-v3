import { AuditAction, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { findProjectById } from '../repositories/project.repository';
import {
  findMilestonesByProjectId,
  findMilestoneByIdAndProject,
  findOverdueMilestoneIds,
  createMilestone as repoCreate,
  updateMilestone as repoUpdate,
  deleteMilestone as repoDelete,
} from '../repositories/milestone.repository';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from './audit.service';

export async function listMilestones(projectId: string) {
  const project = await findProjectById(projectId);
  if (!project) return null;

  const [milestones, overdueIds] = await Promise.all([
    findMilestonesByProjectId(projectId),
    findOverdueMilestoneIds(projectId),
  ]);

  return milestones.map((m) => ({
    ...m,
    is_overdue: overdueIds.has(m.id),
  }));
}

export async function getMilestone(projectId: string, id: string) {
  return findMilestoneByIdAndProject(id, projectId);
}

export async function createMilestoneService(
  projectId: string,
  data: { name: string; due_date?: string },
  actorId: string | null,
) {
  const project = await findProjectById(projectId);
  if (!project) return { notFound: 'project' as const };

  const { due_date, ...rest } = data;

  const milestone = await prisma.$transaction(async (tx) => {
    const created = await repoCreate(tx, {
      ...rest,
      project_id: projectId,
      due_date: due_date ? new Date(due_date) : undefined,
    } as Prisma.MilestoneUncheckedCreateInput);

    await writeAudit(tx, {
      entityType: 'Milestone',
      entityId: created.id,
      action: AuditAction.CREATE,
      actorId,
      changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
    });

    return created;
  });

  return milestone;
}

export async function updateMilestoneService(
  projectId: string,
  id: string,
  data: { name?: string; due_date?: string | null },
  actorId: string | null,
) {
  const { due_date, ...rest } = data;

  const updateData: Record<string, unknown> = { ...rest };
  if (due_date !== undefined) {
    updateData.due_date = due_date ? new Date(due_date) : null;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await findMilestoneByIdAndProject(id, projectId, tx);
    if (!existing) return null;

    const updated = await repoUpdate(tx, id, updateData);

    const changedFields = buildUpdateAuditFields(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    if (changedFields) {
      await writeAudit(tx, {
        entityType: 'Milestone',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        actorId,
        changedFields,
      });
    }

    return updated;
  });
}

export async function deleteMilestoneService(
  projectId: string,
  id: string,
  actorId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await findMilestoneByIdAndProject(id, projectId, tx);
    if (!existing) return null;

    await repoDelete(tx, id);

    await writeAudit(tx, {
      entityType: 'Milestone',
      entityId: id,
      action: AuditAction.DELETE,
      actorId,
      changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
    });

    return existing;
  });
}
