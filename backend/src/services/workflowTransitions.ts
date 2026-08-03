import { ProjectRole } from '@prisma/client';
import { prisma } from '../infrastructure/db';
import { getProjectRole } from './permissions';

export class WorkflowTransitionError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function validateWorkflowTransition(input: {
  workflowId: string;
  fromStatusId: string;
  toStatusId: string;
  projectId: string;
  userId: string;
  assigneeId?: string | null;
  comment?: string;
}) {
  if (input.fromStatusId === input.toStatusId) return null;

  const configuredCount = await prisma.workflowTransition.count({
    where: { workflow_id: input.workflowId, is_active: true },
  });
  if (configuredCount === 0) return null;

  const role = await getProjectRole(input.userId, input.projectId);
  const roleFilter = role === 'GLOBAL_ADMIN'
    ? {}
    : { OR: [{ allowed_role: null }, { allowed_role: role as ProjectRole }] };
  const transition = await prisma.workflowTransition.findFirst({
    where: {
      workflow_id: input.workflowId,
      from_status_id: input.fromStatusId,
      to_status_id: input.toStatusId,
      is_active: true,
      ...roleFilter,
    },
  });

  if (!transition) throw new WorkflowTransitionError('Transition is not allowed for this item and user role');
  if (transition.requires_assignee && !input.assigneeId) {
    throw new WorkflowTransitionError('This transition requires an assigned user');
  }
  if (transition.requires_comment && !input.comment?.trim()) {
    throw new WorkflowTransitionError('This transition requires a comment');
  }
  return transition;
}
