import { AuditAction, ProjectStatus, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import {
  findAllProjects,
  findProjectById,
  findProjectByIdWithBudgetSummary,
  createProject as repoCreate,
  updateProject as repoUpdate,
  archiveProject as repoArchive,
} from '../repositories/project.repository';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from './audit.service';

export async function listProjects(status?: string) {
  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status as ProjectStatus;
  }
  return findAllProjects(where);
}

export async function getProject(id: string) {
  const project = await findProjectByIdWithBudgetSummary(id);
  if (!project) return null;

  const { time_entries, ...rest } = project;
  const totalHours = time_entries.reduce(
    (sum, e) => sum.add(e.hours_worked),
    new Prisma.Decimal(0),
  );

  return {
    ...rest,
    budget_summary: {
      total_logged_hours: totalHours,
    },
  };
}

export async function createProjectService(
  data: {
    name: string;
    description?: string;
    status?: ProjectStatus;
    start_date?: string;
    end_date?: string;
    budget_type?: string;
    budget_amount?: number;
    currency_code?: string;
  },
  actorId: string | null,
) {
  const { start_date, end_date, ...rest } = data;

  return prisma.$transaction(async (tx) => {
    const created = await repoCreate(tx, {
      ...rest,
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
    } as Prisma.ProjectCreateInput);

    await writeAudit(tx, {
      entityType: 'Project',
      entityId: created.id,
      action: AuditAction.CREATE,
      actorId,
      changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
    });

    return created;
  });
}

export async function updateProjectService(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    status?: ProjectStatus;
    start_date?: string | null;
    end_date?: string | null;
    budget_type?: string;
    budget_amount?: number | null;
    currency_code?: string;
  },
  actorId: string | null,
) {
  const { start_date, end_date, ...rest } = data;

  const updateData: Record<string, unknown> = { ...rest };
  if (start_date !== undefined) {
    updateData.start_date = start_date ? new Date(start_date) : null;
  }
  if (end_date !== undefined) {
    updateData.end_date = end_date ? new Date(end_date) : null;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await findProjectById(id, tx);
    if (!existing) return null;

    const updated = await repoUpdate(tx, id, updateData);

    const changedFields = buildUpdateAuditFields(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    if (changedFields) {
      await writeAudit(tx, {
        entityType: 'Project',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        actorId,
        changedFields,
      });
    }

    return updated;
  });
}

export async function archiveProjectService(id: string, actorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const existing = await findProjectById(id, tx);
    if (!existing) return null;

    const updated = await repoArchive(tx, id);

    await writeAudit(tx, {
      entityType: 'Project',
      entityId: updated.id,
      action: AuditAction.DELETE,
      actorId,
      changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
    });

    return updated;
  });
}
