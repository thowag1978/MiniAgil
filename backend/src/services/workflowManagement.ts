import { ItemType, Prisma, ProjectRole, WorkflowCategory } from '@prisma/client';
import { prisma } from '../infrastructure/db';

export class WorkflowManagementError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const workflowInclude = {
  statuses: {
    orderBy: [{ position: 'asc' as const }, { name: 'asc' as const }],
    include: { _count: { select: { items: true } } },
  },
  transitions: {
    include: { fromStatus: true, toStatus: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.WorkflowInclude;

async function getWorkflow(projectId: string, workflowId: string) {
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, project_id: projectId },
    include: workflowInclude,
  });
  if (!workflow) throw new WorkflowManagementError(404, 'Workflow not found');
  return workflow;
}

export async function listProjectWorkflows(projectId: string) {
  return prisma.workflow.findMany({
    where: { project_id: projectId },
    include: workflowInclude,
    orderBy: [{ item_type: 'asc' }, { name: 'asc' }],
  });
}

export async function getProjectWorkflowByType(projectId: string, itemType: ItemType) {
  const workflow = await prisma.workflow.findFirst({
    where: { project_id: projectId, item_type: itemType },
    include: workflowInclude,
    orderBy: [{ is_default: 'desc' }, { createdAt: 'asc' }],
  });
  if (!workflow) throw new WorkflowManagementError(404, 'Workflow not found');
  return workflow;
}

export async function createProjectWorkflow(projectId: string, name: string, itemType: ItemType) {
  return prisma.workflow.create({
    data: {
      project_id: projectId,
      name,
      item_type: itemType,
      statuses: {
        create: [
          { name: 'Backlog', category: 'BACKLOG', color: '#64748B', position: 0, order: 0, is_initial: true },
          { name: 'A fazer', category: 'TODO', color: '#3B82F6', position: 1, order: 1 },
          { name: 'Em andamento', category: 'IN_PROGRESS', color: '#F59E0B', position: 2, order: 2 },
          { name: 'Concluído', category: 'DONE', color: '#10B981', position: 3, order: 3, is_final: true },
        ],
      },
    },
    include: workflowInclude,
  });
}

export async function renameProjectWorkflow(projectId: string, workflowId: string, name: string) {
  await getWorkflow(projectId, workflowId);
  return prisma.workflow.update({ where: { id: workflowId }, data: { name }, include: workflowInclude });
}

export async function createWorkflowStatus(
  projectId: string,
  workflowId: string,
  data: { name: string; category: WorkflowCategory; color: string; position?: number; is_initial?: boolean; is_final?: boolean; wip_limit?: number | null },
) {
  const workflow = await getWorkflow(projectId, workflowId);
  const position = data.position ?? workflow.statuses.length;
  return prisma.$transaction(async (tx) => {
    if (data.is_initial) {
      await tx.workflowStatus.updateMany({ where: { workflow_id: workflowId }, data: { is_initial: false } });
    }
    return tx.workflowStatus.create({
      data: { workflow_id: workflowId, ...data, position, order: position, is_active: true },
    });
  });
}

export async function updateWorkflowStatus(
  projectId: string,
  workflowId: string,
  statusId: string,
  data: Prisma.WorkflowStatusUpdateInput,
  replacementStatusId?: string,
) {
  const workflow = await getWorkflow(projectId, workflowId);
  const current = workflow.statuses.find((status) => status.id === statusId);
  if (!current) throw new WorkflowManagementError(404, 'Workflow status not found');

  const deactivating = data.is_active === false && current.is_active;
  const removingInitial = current.is_initial && (data.is_initial === false || deactivating);
  const removingFinal = current.is_final && (data.is_final === false || deactivating);
  const itemCount = deactivating ? await prisma.item.count({ where: { workflow_status_id: statusId } }) : 0;
  let replacement = replacementStatusId
    ? workflow.statuses.find((status) => status.id === replacementStatusId && status.id !== statusId)
    : undefined;

  if (itemCount > 0 && (!replacement || !replacement.is_active)) {
    throw new WorkflowManagementError(400, 'An active replacement_status_id from the same workflow is required');
  }
  if (replacementStatusId && (!replacement || !replacement.is_active)) {
    throw new WorkflowManagementError(400, 'Invalid replacement status');
  }

  const otherActiveInitial = workflow.statuses.some((status) => status.id !== statusId && status.is_active && status.is_initial);
  if (removingInitial && !otherActiveInitial && !replacement) {
    throw new WorkflowManagementError(400, 'Workflow must have exactly one active initial status');
  }
  const otherActiveFinal = workflow.statuses.some((status) => status.id !== statusId && status.is_active && status.is_final);
  if (removingFinal && !otherActiveFinal && !replacement) {
    throw new WorkflowManagementError(400, 'Workflow must have at least one active final status');
  }
  if (data.is_initial === true && data.is_active === false) {
    throw new WorkflowManagementError(400, 'Initial status must be active');
  }

  return prisma.$transaction(async (tx) => {
    if (data.is_initial === true) {
      await tx.workflowStatus.updateMany({
        where: { workflow_id: workflowId, id: { not: statusId } },
        data: { is_initial: false },
      });
    }
    if (replacement && itemCount > 0) {
      await tx.item.updateMany({ where: { workflow_status_id: statusId }, data: { workflow_status_id: replacement.id } });
    }
    if (replacement && removingInitial) {
      await tx.workflowStatus.update({ where: { id: replacement.id }, data: { is_initial: true } });
    }
    if (replacement && removingFinal && !otherActiveFinal) {
      await tx.workflowStatus.update({ where: { id: replacement.id }, data: { is_final: true } });
    }
    return tx.workflowStatus.update({ where: { id: statusId }, data });
  });
}

export async function reorderWorkflowStatuses(projectId: string, workflowId: string, statusIds: string[]) {
  const workflow = await getWorkflow(projectId, workflowId);
  const currentIds = workflow.statuses.map((status) => status.id);
  if (statusIds.length !== currentIds.length || new Set(statusIds).size !== statusIds.length || statusIds.some((id) => !currentIds.includes(id))) {
    throw new WorkflowManagementError(400, 'status_ids must contain every workflow status exactly once');
  }
  await prisma.$transaction(statusIds.map((id, position) => prisma.workflowStatus.update({
    where: { id }, data: { position, order: position },
  })));
  return getWorkflow(projectId, workflowId);
}

export async function deleteWorkflowStatus(projectId: string, workflowId: string, statusId: string) {
  const workflow = await getWorkflow(projectId, workflowId);
  const status = workflow.statuses.find((entry) => entry.id === statusId);
  if (!status) throw new WorkflowManagementError(404, 'Workflow status not found');
  if (await prisma.item.count({ where: { workflow_status_id: statusId } })) {
    throw new WorkflowManagementError(409, 'Status is used by items and cannot be deleted');
  }
  if (status.is_initial) throw new WorkflowManagementError(400, 'Initial status cannot be deleted');
  if (status.is_final && !workflow.statuses.some((entry) => entry.id !== statusId && entry.is_active && entry.is_final)) {
    throw new WorkflowManagementError(400, 'Workflow must have at least one active final status');
  }
  await prisma.workflowStatus.delete({ where: { id: statusId } });
}

export async function createWorkflowTransition(
  projectId: string,
  workflowId: string,
  data: { from_status_id: string; to_status_id: string; allowed_role?: ProjectRole | null; requires_comment?: boolean; requires_assignee?: boolean; is_active?: boolean },
) {
  const workflow = await getWorkflow(projectId, workflowId);
  if (data.from_status_id === data.to_status_id) throw new WorkflowManagementError(400, 'Origin and destination statuses must be different');
  const statusIds = new Set(workflow.statuses.map(({ id }) => id));
  if (!statusIds.has(data.from_status_id) || !statusIds.has(data.to_status_id)) {
    throw new WorkflowManagementError(400, 'Transition statuses must belong to this workflow');
  }
  const duplicate = await prisma.workflowTransition.findFirst({
    where: {
      workflow_id: workflowId,
      from_status_id: data.from_status_id,
      to_status_id: data.to_status_id,
      allowed_role: data.allowed_role ?? null,
    },
    select: { id: true },
  });
  if (duplicate) throw new WorkflowManagementError(409, 'This workflow transition already exists');
  return prisma.workflowTransition.create({
    data: { workflow_id: workflowId, ...data },
    include: { fromStatus: true, toStatus: true },
  });
}

export async function updateWorkflowTransition(
  projectId: string,
  workflowId: string,
  transitionId: string,
  data: { allowed_role?: ProjectRole | null; requires_comment?: boolean; requires_assignee?: boolean; is_active?: boolean },
) {
  await getWorkflow(projectId, workflowId);
  const transition = await prisma.workflowTransition.findFirst({
    where: { id: transitionId, workflow_id: workflowId }, select: { id: true },
  });
  if (!transition) throw new WorkflowManagementError(404, 'Workflow transition not found');
  return prisma.workflowTransition.update({
    where: { id: transitionId }, data,
    include: { fromStatus: true, toStatus: true },
  });
}

export async function listWorkflowTransitions(projectId: string, workflowId: string) {
  await getWorkflow(projectId, workflowId);
  return prisma.workflowTransition.findMany({
    where: { workflow_id: workflowId },
    include: { fromStatus: true, toStatus: true },
    orderBy: { createdAt: 'asc' },
  });
}
