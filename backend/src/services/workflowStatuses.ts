import { ItemType } from '@prisma/client';
import { prisma } from '../infrastructure/db';

export async function resolveWorkflowStatusId(
  statusId: string,
  projectId: string,
  itemType: ItemType,
) {
  const status = await prisma.workflowStatus.findUnique({
    where: { id: statusId },
    select: {
      id: true,
      name: true,
      is_active: true,
      workflow: { select: { project_id: true, item_type: true } },
    },
  });
  if (!status || status.is_active === false) return null;
  if (status.workflow?.project_id === projectId && status.workflow.item_type === itemType) {
    return status.id;
  }
  if (status.workflow) return null;

  const compatible = await prisma.workflowStatus.findFirst({
    where: {
      name: status.name,
      workflow: { project_id: projectId, item_type: itemType, is_default: true },
    },
    select: { id: true },
  });
  return compatible?.id ?? null;
}

export async function listWorkflowStatuses(projectId?: string, itemType?: ItemType) {
  if (projectId && itemType) {
    return prisma.workflowStatus.findMany({
      where: { is_active: true, workflow: { project_id: projectId, item_type: itemType, is_default: true } },
      orderBy: [{ position: 'asc' }, { order: 'asc' }],
    });
  }
  return prisma.workflowStatus.findMany({
    where: { workflow_id: null },
    orderBy: { order: 'asc' },
  });
}
