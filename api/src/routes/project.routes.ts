import { Router, Response } from 'express';
import { z } from 'zod';
import { AuditAction, BudgetType, ProjectStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from '../services/audit.service';

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget_type: z.nativeEnum(BudgetType).optional(),
  budget_amount: z.number().optional(),
  currency_code: z.string().length(3).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  budget_type: z.nativeEnum(BudgetType).optional(),
  budget_amount: z.number().nullable().optional(),
  currency_code: z.string().length(3).optional(),
});

// GET /api/projects
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;
    const where: Record<string, unknown> = {};

    if (status && typeof status === 'string') {
      where.status = status as ProjectStatus;
    }

    const projects = await prisma.project.findMany({ where });
    res.json(projects);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const { start_date, end_date, ...rest } = parsed.data;

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          ...rest,
          start_date: start_date ? new Date(start_date) : undefined,
          end_date: end_date ? new Date(end_date) : undefined,
        },
      });

      await writeAudit(tx, {
        entityType: 'Project',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId,
        changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
      });

      return created;
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const { start_date, end_date, ...rest } = parsed.data;

    const data: Record<string, unknown> = { ...rest };
    if (start_date !== undefined) {
      data.start_date = start_date ? new Date(start_date) : null;
    }
    if (end_date !== undefined) {
      data.end_date = end_date ? new Date(end_date) : null;
    }

    const project = await prisma.$transaction(async (tx) => {
      const existing = await tx.project.findUnique({ where: { id: req.params.id } });
      if (!existing) return null;

      const updated = await tx.project.update({
        where: { id: req.params.id },
        data,
      });

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

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id — archive
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actorId = req.user?.teamMemberId ?? null;

    const project = await prisma.$transaction(async (tx) => {
      const existing = await tx.project.findUnique({ where: { id: req.params.id } });
      if (!existing) return null;

      const updated = await tx.project.update({
        where: { id: req.params.id },
        data: { status: ProjectStatus.ARCHIVED },
      });

      await writeAudit(tx, {
        entityType: 'Project',
        entityId: updated.id,
        action: AuditAction.DELETE,
        actorId,
        changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
      });

      return updated;
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
