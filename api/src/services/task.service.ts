import { AuditAction, TaskStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from './audit.service';
import {
  findProjectById,
  findTasksByProject,
  findTaskByIdAndProject,
  findTaskByIdAndProjectTx,
  createTask,
  updateTask,
  deleteTask,
  TaskListFilters,
} from '../repositories/task.repository';

export async function listTasks(filters: TaskListFilters) {
  const project = await findProjectById(filters.project_id);
  if (!project) return { error: 'Project not found' as const };

  const tasks = await findTasksByProject(filters);
  return { data: tasks };
}

export async function getTask(projectId: string, taskId: string) {
  const task = await findTaskByIdAndProject(taskId, projectId);
  if (!task) return { error: 'Task not found' as const };
  return { data: task };
}

export async function createNewTask(
  projectId: string,
  input: { description: string; milestone_id?: string; status?: TaskStatus },
  actorId: string | null,
) {
  const project = await findProjectById(projectId);
  if (!project) return { error: 'Project not found' as const };

  const status = input.status ?? TaskStatus.TODO;
  const now = new Date();

  const task = await prisma.$transaction(async (tx) => {
    const created = await createTask(tx, {
      description: input.description,
      project_id: projectId,
      milestone_id: input.milestone_id ?? null,
      status,
      started_at: status === TaskStatus.IN_PROGRESS || status === TaskStatus.DONE ? now : undefined,
      completed_at: status === TaskStatus.DONE ? now : undefined,
    });

    await writeAudit(tx, {
      entityType: 'Task',
      entityId: created.id,
      action: AuditAction.CREATE,
      actorId,
      changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
    });

    return created;
  });

  return { data: task };
}

export async function updateExistingTask(
  projectId: string,
  taskId: string,
  input: { description?: string; milestone_id?: string | null; status?: TaskStatus },
  actorId: string | null,
) {
  const task = await prisma.$transaction(async (tx) => {
    const existing = await findTaskByIdAndProjectTx(tx, taskId, projectId);
    if (!existing) return null;

    const data: Record<string, unknown> = {};

    if (input.description !== undefined) {
      data.description = input.description;
    }
    if (input.milestone_id !== undefined) {
      data.milestone_id = input.milestone_id;
    }

    // Status transition rules
    if (input.status !== undefined) {
      const newStatus = input.status;
      data.status = newStatus;

      // started_at: set to NOW() first time status moves to IN_PROGRESS, never overwritten
      if (newStatus === TaskStatus.IN_PROGRESS && !existing.started_at) {
        data.started_at = new Date();
      }

      // completed_at: set to NOW() when DONE
      if (newStatus === TaskStatus.DONE) {
        data.completed_at = new Date();
        // Also set started_at if it was never set
        if (!existing.started_at) {
          data.started_at = new Date();
        }
      }

      // completed_at: cleared when moved out of DONE
      if (newStatus !== TaskStatus.DONE && existing.status === TaskStatus.DONE) {
        data.completed_at = null;
      }
    }

    const updated = await updateTask(tx, taskId, data);

    const changedFields = buildUpdateAuditFields(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    if (changedFields) {
      await writeAudit(tx, {
        entityType: 'Task',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        actorId,
        changedFields,
      });
    }

    return updated;
  });

  if (!task) return { error: 'Task not found' as const };
  return { data: task };
}

export async function deleteExistingTask(
  projectId: string,
  taskId: string,
  actorId: string | null,
) {
  const task = await prisma.$transaction(async (tx) => {
    const existing = await findTaskByIdAndProjectTx(tx, taskId, projectId);
    if (!existing) return null;

    await deleteTask(tx, taskId);

    await writeAudit(tx, {
      entityType: 'Task',
      entityId: taskId,
      action: AuditAction.DELETE,
      actorId,
      changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
    });

    return existing;
  });

  if (!task) return { error: 'Task not found' as const };
  return { data: task };
}
