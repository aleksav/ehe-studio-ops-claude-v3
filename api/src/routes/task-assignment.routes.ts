import { Router, Response } from 'express';
import { z } from 'zod';
import { AuditAction, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import {
  writeAudit,
  buildCreateAuditFields,
  buildDeleteAuditFields,
} from '../services/audit.service';

const router = Router({ mergeParams: true });

const createAssignmentSchema = z.object({
  team_member_id: z.string().uuid(),
});

// GET /api/tasks/:taskId/assignments
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const assignments = await prisma.taskAssignment.findMany({
      where: { task_id: taskId },
      include: { team_member: true },
    });

    res.json(assignments);
  } catch (error) {
    console.error('List assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/:taskId/assignments
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { taskId } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: { id: parsed.data.team_member_id },
    });
    if (!teamMember) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.taskAssignment.create({
        data: {
          task_id: taskId,
          team_member_id: parsed.data.team_member_id,
        },
        include: { team_member: true },
      });

      await writeAudit(tx, {
        entityType: 'TaskAssignment',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId,
        changedFields: buildCreateAuditFields({
          id: created.id,
          task_id: created.task_id,
          team_member_id: created.team_member_id,
        }),
      });

      return created;
    });

    res.status(201).json(assignment);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      res.status(409).json({ error: 'Team member is already assigned to this task' });
      return;
    }
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:taskId/assignments/:teamMemberId
router.delete('/:teamMemberId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId, teamMemberId } = req.params;
    const actorId = req.user?.teamMemberId ?? null;

    const assignment = await prisma.$transaction(async (tx) => {
      const existing = await tx.taskAssignment.findUnique({
        where: {
          task_id_team_member_id: {
            task_id: taskId,
            team_member_id: teamMemberId,
          },
        },
      });
      if (!existing) return null;

      await tx.taskAssignment.delete({
        where: {
          task_id_team_member_id: {
            task_id: taskId,
            team_member_id: teamMemberId,
          },
        },
      });

      await writeAudit(tx, {
        entityType: 'TaskAssignment',
        entityId: existing.id,
        action: AuditAction.DELETE,
        actorId,
        changedFields: buildDeleteAuditFields({
          id: existing.id,
          task_id: existing.task_id,
          team_member_id: existing.team_member_id,
        }),
      });

      return existing;
    });

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    res.json({ message: 'Assignment removed' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
