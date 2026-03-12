import { Router, Response } from 'express';
import { z } from 'zod';
import { AuditAction } from '@prisma/client';
import prisma from '../utils/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from '../services/audit.service';

const router = Router({ mergeParams: true });

const createMilestoneSchema = z.object({
  name: z.string().min(1),
  due_date: z.string().optional(),
});

const updateMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  due_date: z.string().nullable().optional(),
});

// GET /api/projects/:projectId/milestones
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const milestones = await prisma.milestone.findMany({
      where: { project_id: projectId },
      orderBy: { due_date: { sort: 'asc', nulls: 'last' } },
    });

    res.json(milestones);
  } catch (error) {
    console.error('List milestones error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:projectId/milestones/:id
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, id } = req.params;

    const milestone = await prisma.milestone.findFirst({
      where: { id, project_id: projectId },
    });

    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }

    res.json(milestone);
  } catch (error) {
    console.error('Get milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:projectId/milestones
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createMilestoneSchema.safeParse(req.body);
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

    const { due_date, ...rest } = parsed.data;

    const milestone = await prisma.$transaction(async (tx) => {
      const created = await tx.milestone.create({
        data: {
          ...rest,
          project_id: projectId,
          due_date: due_date ? new Date(due_date) : undefined,
        },
      });

      await writeAudit(tx, {
        entityType: 'Milestone',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId,
        changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
      });

      return created;
    });

    res.status(201).json(milestone);
  } catch (error) {
    console.error('Create milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:projectId/milestones/:id
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = updateMilestoneSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { projectId, id } = req.params;
    const actorId = req.user?.teamMemberId ?? null;
    const { due_date, ...rest } = parsed.data;

    const data: Record<string, unknown> = { ...rest };
    if (due_date !== undefined) {
      data.due_date = due_date ? new Date(due_date) : null;
    }

    const milestone = await prisma.$transaction(async (tx) => {
      const existing = await tx.milestone.findFirst({
        where: { id, project_id: projectId },
      });
      if (!existing) return null;

      const updated = await tx.milestone.update({
        where: { id },
        data,
      });

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

    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }

    res.json(milestone);
  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:projectId/milestones/:id
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, id } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const milestone = await prisma.$transaction(async (tx) => {
      const existing = await tx.milestone.findFirst({
        where: { id, project_id: projectId },
      });
      if (!existing) return null;

      await tx.milestone.delete({ where: { id } });

      await writeAudit(tx, {
        entityType: 'Milestone',
        entityId: id,
        action: AuditAction.DELETE,
        actorId,
        changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
      });

      return existing;
    });

    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }

    res.json({ message: 'Milestone deleted' });
  } catch (error) {
    console.error('Delete milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
