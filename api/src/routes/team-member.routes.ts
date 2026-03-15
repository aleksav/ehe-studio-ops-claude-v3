import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AuditAction, MemberType, TaskType } from '../generated/prisma/client';
import prisma from '../utils/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import {
  writeAudit,
  buildCreateAuditFields,
  buildUpdateAuditFields,
  buildDeleteAuditFields,
} from '../services/audit.service';

const router = Router();

const createTeamMemberSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  role_title: z.string().optional(),
  preferred_task_type: z.nativeEnum(TaskType).optional(),
  member_type: z.nativeEnum(MemberType).optional(),
});

const updateTeamMemberSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role_title: z.string().nullable().optional(),
  preferred_task_type: z.nativeEnum(TaskType).nullable().optional(),
  member_type: z.nativeEnum(MemberType).optional(),
  is_active: z.boolean().optional(),
});

// GET /api/team-members
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { is_active } = req.query;
    const where: Record<string, unknown> = {};

    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    const teamMembers = await prisma.teamMember.findMany({
      where,
      orderBy: { full_name: 'asc' },
    });
    res.json(teamMembers);
  } catch (error) {
    console.error('List team members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/team-members/:id
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teamMember = await prisma.teamMember.findUnique({
      where: { id: req.params.id },
    });

    if (!teamMember) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }

    res.json(teamMember);
  } catch (error) {
    console.error('Get team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/team-members
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createTeamMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;

    const teamMember = await prisma.$transaction(async (tx) => {
      const created = await tx.teamMember.create({ data: parsed.data });

      await writeAudit(tx, {
        entityType: 'TeamMember',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId,
        changedFields: buildCreateAuditFields(created as unknown as Record<string, unknown>),
      });

      return created;
    });

    res.status(201).json(teamMember);
  } catch (error) {
    console.error('Create team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/team-members/:id
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = updateTeamMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;

    const teamMember = await prisma.$transaction(async (tx) => {
      const existing = await tx.teamMember.findUnique({ where: { id: req.params.id } });
      if (!existing) return null;

      const updated = await tx.teamMember.update({
        where: { id: req.params.id },
        data: parsed.data,
      });

      const changedFields = buildUpdateAuditFields(
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
      );

      if (changedFields) {
        await writeAudit(tx, {
          entityType: 'TeamMember',
          entityId: updated.id,
          action: AuditAction.UPDATE,
          actorId,
          changedFields,
        });
      }

      return updated;
    });

    if (!teamMember) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }

    res.json(teamMember);
  } catch (error) {
    console.error('Update team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/team-members/:id — soft delete
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actorId = req.user?.teamMemberId ?? null;

    const teamMember = await prisma.$transaction(async (tx) => {
      const existing = await tx.teamMember.findUnique({ where: { id: req.params.id } });
      if (!existing) return null;

      const updated = await tx.teamMember.update({
        where: { id: req.params.id },
        data: { is_active: false },
      });

      await writeAudit(tx, {
        entityType: 'TeamMember',
        entityId: updated.id,
        action: AuditAction.DELETE,
        actorId,
        changedFields: buildDeleteAuditFields(existing as unknown as Record<string, unknown>),
      });

      return updated;
    });

    if (!teamMember) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }

    res.json(teamMember);
  } catch (error) {
    console.error('Delete team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/team-members/:id/password
router.put('/:id/password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { new_password } = req.body;

    if (!new_password || typeof new_password !== 'string') {
      res.status(400).json({ error: 'new_password is required' });
      return;
    }

    if (new_password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    if (!/[A-Z]/.test(new_password) || !/[a-z]/.test(new_password) || !/[0-9]/.test(new_password)) {
      res.status(400).json({
        error:
          'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      });
      return;
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!teamMember) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }

    if (!teamMember.user) {
      res.status(404).json({ error: 'No user account linked to this team member' });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const password_hash = await bcrypt.hash(new_password, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: teamMember.user!.id },
        data: { password_hash },
      });

      await writeAudit(tx, {
        entityType: 'User',
        entityId: teamMember.user!.id,
        action: AuditAction.UPDATE,
        actorId,
        changedFields: { password: { before: '***', after: '***' } },
      });
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update team member password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
