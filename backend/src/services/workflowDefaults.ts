import { ItemType, Prisma, WorkflowCategory } from '@prisma/client';

const defaultStatuses = [
  { name: 'A FAZER', category: WorkflowCategory.TODO, color: '#64748B', position: 10, order: 10, is_initial: true, is_final: false },
  { name: 'EM PROGRESSO', category: WorkflowCategory.IN_PROGRESS, color: '#3B82F6', position: 20, order: 20, is_initial: false, is_final: false },
  { name: 'PARA REVISÃO', category: WorkflowCategory.REVIEW, color: '#F59E0B', position: 30, order: 30, is_initial: false, is_final: false },
  { name: 'CONCLUÍDO', category: WorkflowCategory.DONE, color: '#22C55E', position: 40, order: 40, is_initial: false, is_final: true },
];

const defaultBugStatuses = [
  { name: 'Registrado', category: WorkflowCategory.BACKLOG, color: '#64748B', position: 10, order: 10, is_initial: true, is_final: false },
  { name: 'Triagem', category: WorkflowCategory.TODO, color: '#3B82F6', position: 20, order: 20, is_initial: false, is_final: false },
  { name: 'Aguardando informações', category: WorkflowCategory.TODO, color: '#A855F7', position: 30, order: 30, is_initial: false, is_final: false },
  { name: 'Em correção', category: WorkflowCategory.IN_PROGRESS, color: '#F59E0B', position: 40, order: 40, is_initial: false, is_final: false },
  { name: 'Code review', category: WorkflowCategory.REVIEW, color: '#8B5CF6', position: 50, order: 50, is_initial: false, is_final: false },
  { name: 'Pronto para reteste', category: WorkflowCategory.REVIEW, color: '#06B6D4', position: 60, order: 60, is_initial: false, is_final: false },
  { name: 'Em reteste', category: WorkflowCategory.IN_PROGRESS, color: '#0EA5E9', position: 70, order: 70, is_initial: false, is_final: false },
  { name: 'Homologado', category: WorkflowCategory.DONE, color: '#22C55E', position: 80, order: 80, is_initial: false, is_final: false },
  { name: 'Fechado', category: WorkflowCategory.DONE, color: '#16A34A', position: 90, order: 90, is_initial: false, is_final: true },
  { name: 'Reaberto', category: WorkflowCategory.IN_PROGRESS, color: '#EF4444', position: 100, order: 100, is_initial: false, is_final: false },
];

export async function createDefaultWorkflows(tx: Prisma.TransactionClient, projectId: string) {
  for (const itemType of Object.values(ItemType)) {
    await tx.workflow.create({
      data: {
        project_id: projectId,
        item_type: itemType,
        name: `Workflow padrão - ${itemType}`,
        is_default: true,
        statuses: { create: itemType === ItemType.BUG ? defaultBugStatuses : defaultStatuses },
      },
    });
  }
}
