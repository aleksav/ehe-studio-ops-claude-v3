import prisma from '../utils/prisma';
import { TransactionClient } from '../utils/prisma';

export async function findTaskById(taskId: string) {
  return prisma.task.findUnique({ where: { id: taskId } });
}

export async function findTeamMemberById(teamMemberId: string) {
  return prisma.teamMember.findUnique({ where: { id: teamMemberId } });
}

export async function findAssignmentsByTaskId(taskId: string) {
  return prisma.taskAssignment.findMany({
    where: { task_id: taskId },
    include: { team_member: true },
  });
}

export async function createAssignment(
  tx: TransactionClient,
  data: { task_id: string; team_member_id: string },
) {
  return tx.taskAssignment.create({
    data,
    include: { team_member: true },
  });
}

export async function findAssignmentByComposite(
  tx: TransactionClient,
  taskId: string,
  teamMemberId: string,
) {
  return tx.taskAssignment.findUnique({
    where: {
      task_id_team_member_id: {
        task_id: taskId,
        team_member_id: teamMemberId,
      },
    },
  });
}

export async function deleteAssignment(
  tx: TransactionClient,
  taskId: string,
  teamMemberId: string,
) {
  return tx.taskAssignment.delete({
    where: {
      task_id_team_member_id: {
        task_id: taskId,
        team_member_id: teamMemberId,
      },
    },
  });
}
