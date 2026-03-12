import { Router, Response } from 'express';
import { z } from 'zod';
import { AuditAction, TaskStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from '../services/audit.service';

const router = Router({ mergeParams: true });

const createTaskSchema = z.object({
  description: z.string().min(1),
  milestone_id: z.string().uuid().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
});

const updateTaskSchema = z.object({
  description: z.string().min(1).optional(),
  milestone_id: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
});

// GET /api/projects/:projectId/tasks
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { status, milestone_id } = req.query;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const where: Record<string, unknown> = { project_id: projectId };

    if (status && typeof status === 'string') {
      where.status = status as TaskStatus;
    } else {
      // Exclude CANCELLED by default
      where.status = { not: TaskStatus.CANCELLED };
    }

    if (milestone_id && typeof milestone_id === 'string') {
      where.milestone_id = milestone_id;
    }

    const tasks = await prisma.task.findMany({ where });
    res.json(tasks);
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:projectId/tasks/:id
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, id } = req.params;

    const task = await prisma.task.findFirst({
      where: { id, project_id: projectId },
      include: {
        assignments: {
          include: { team_member: true },
        },
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:projectId/tasks
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { projectId } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const task = await prisma.$transaction(async (tx) => {
      const status = parsed.data.status ?? TaskStatus.TODO;
      const now = new Date();

      const created = await tx.task.create({
        data: {
          description: parsed.data.description,
          project_id: projectId,
          milestone_id: parsed.data.milestone_id ?? null,
          status,
          started_at:
            status === TaskStatus.IN_PROGRESS || status === TaskStatus.DONE ? now : undefined,
          completed_at: status === TaskStatus.DONE ? now : undefined,
        },
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

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:projectId/tasks/:id
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { projectId, id } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
        where: { id, project_id: projectId },
      });
      if (!existing) return null;

      const data: Record<string, unknown> = {};

      if (parsed.data.description !== undefined) {
        data.description = parsed.data.description;
      }
      if (parsed.data.milestone_id !== undefined) {
        data.milestone_id = parsed.data.milestone_id;
      }

      // Status transition rules
      if (parsed.data.status !== undefined) {
        const newStatus = parsed.data.status;
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

      const updated = await tx.task.update({
        where: { id },
        data,
      });

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

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:projectId/tasks/:id
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, id } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
        where: { id, project_id: projectId },
      });
      if (!existing) return null;

      await tx.task.delete({ where: { id } });

      await writeAudit(tx, {
        entityType: 'Task',
        entityId: id,
        action: AuditAction.DELETE,
        actorId,
        changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
      });

      return existing;
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
