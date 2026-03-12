import { AuditAction, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { writeAudit, buildCreateAuditFields, buildDeleteAuditFields } from './audit.service';
import {
  findTaskById,
  findTeamMemberById,
  findAssignmentsByTaskId,
  createAssignment,
  findAssignmentByComposite,
  deleteAssignment,
} from '../repositories/task-assignment.repository';

export async function listAssignments(taskId: string) {
  const task = await findTaskById(taskId);
  if (!task) return { error: 'Task not found' as const };

  const assignments = await findAssignmentsByTaskId(taskId);
  return { data: assignments };
}

export async function assignMember(taskId: string, teamMemberId: string, actorId: string | null) {
  const task = await findTaskById(taskId);
  if (!task) return { error: 'Task not found' as const };

  const teamMember = await findTeamMemberById(teamMemberId);
  if (!teamMember) return { error: 'Team member not found' as const };

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const created = await createAssignment(tx, {
        task_id: taskId,
        team_member_id: teamMemberId,
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

    return { data: assignment };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: 'duplicate' as const };
    }
    throw error;
  }
}

export async function unassignMember(taskId: string, teamMemberId: string, actorId: string | null) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await findAssignmentByComposite(tx, taskId, teamMemberId);
    if (!existing) return null;

    await deleteAssignment(tx, taskId, teamMemberId);

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

  if (!result) return { error: 'Assignment not found' as const };
  return { data: result };
}
