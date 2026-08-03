import 'dotenv/config';
import { ItemType, PrismaClient, WorkflowCategory } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@miniagil.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@miniagil.com', password: hashedPassword, role: 'ADMIN' },
  });

  const project = await prisma.project.upsert({
    where: { key_prefix: 'MINI' },
    update: {},
    create: {
      name: 'MiniAgil Platform HQ',
      key_prefix: 'MINI',
      description: 'The internal project management hub',
      next_item_number: 4,
      owner_id: admin.id,
      members: { create: { user_id: admin.id, role: 'OWNER' } },
    },
  });

  const definitions = [
    { name: 'A FAZER', category: WorkflowCategory.TODO, color: '#64748B', position: 10, is_initial: true, is_final: false },
    { name: 'EM PROGRESSO', category: WorkflowCategory.IN_PROGRESS, color: '#3B82F6', position: 20, is_initial: false, is_final: false },
    { name: 'PARA REVISÃO', category: WorkflowCategory.REVIEW, color: '#F59E0B', position: 30, is_initial: false, is_final: false },
    { name: 'CONCLUÍDO', category: WorkflowCategory.DONE, color: '#22C55E', position: 40, is_initial: false, is_final: true },
  ];
  const bugDefinitions = [
    { name: 'Registrado', category: WorkflowCategory.BACKLOG, color: '#64748B', position: 10, is_initial: true, is_final: false },
    { name: 'Triagem', category: WorkflowCategory.TODO, color: '#3B82F6', position: 20, is_initial: false, is_final: false },
    { name: 'Aguardando informações', category: WorkflowCategory.TODO, color: '#A855F7', position: 30, is_initial: false, is_final: false },
    { name: 'Em correção', category: WorkflowCategory.IN_PROGRESS, color: '#F59E0B', position: 40, is_initial: false, is_final: false },
    { name: 'Code review', category: WorkflowCategory.REVIEW, color: '#8B5CF6', position: 50, is_initial: false, is_final: false },
    { name: 'Pronto para reteste', category: WorkflowCategory.REVIEW, color: '#06B6D4', position: 60, is_initial: false, is_final: false },
    { name: 'Em reteste', category: WorkflowCategory.IN_PROGRESS, color: '#0EA5E9', position: 70, is_initial: false, is_final: false },
    { name: 'Homologado', category: WorkflowCategory.DONE, color: '#22C55E', position: 80, is_initial: false, is_final: false },
    { name: 'Fechado', category: WorkflowCategory.DONE, color: '#16A34A', position: 90, is_initial: false, is_final: true },
    { name: 'Reaberto', category: WorkflowCategory.IN_PROGRESS, color: '#EF4444', position: 100, is_initial: false, is_final: false },
  ];
  const statusesByType = new Map<ItemType, Awaited<ReturnType<typeof prisma.workflowStatus.findMany>>>();

  for (const itemType of Object.values(ItemType)) {
    const workflowName = `Workflow padrão - ${itemType}`;
    const workflow = await prisma.workflow.upsert({
      where: { project_id_item_type_name: { project_id: project.id, item_type: itemType, name: workflowName } },
      update: { is_default: true },
      create: { project_id: project.id, item_type: itemType, name: workflowName, is_default: true },
    });
    for (const definition of itemType === ItemType.BUG ? bugDefinitions : definitions) {
      await prisma.workflowStatus.upsert({
        where: { workflow_id_name: { workflow_id: workflow.id, name: definition.name } },
        update: {},
        create: { ...definition, workflow_id: workflow.id, order: definition.position },
      });
    }
    statusesByType.set(itemType, await prisma.workflowStatus.findMany({ where: { workflow_id: workflow.id } }));
  }

  const statusFor = (itemType: ItemType, name: string) => {
    const status = statusesByType.get(itemType)?.find((candidate) => candidate.name === name);
    if (!status) throw new Error(`Missing ${name} status for ${itemType}`);
    return status;
  };

  const sprint = await prisma.sprint.create({
    data: { project_id: project.id, name: 'Sprint 1 - Launch V1', status: 'ACTIVE' },
  });

  await prisma.item.create({
    data: {
      project_id: project.id,
      project_key: 'MINI-1',
      type: ItemType.EPIC,
      title: 'Estruturação Core da Plataforma',
      priority: 'HIGH',
      reporter_id: admin.id,
      workflow_status_id: statusFor(ItemType.EPIC, 'CONCLUÍDO').id,
    },
  });

  const parentItem = await prisma.item.findUnique({ where: { project_key: 'MINI-1' } });
  await prisma.item.create({
    data: {
      project_id: project.id,
      project_key: 'MINI-2',
      type: ItemType.STORY,
      title: 'Habilitar Kanban Drag & Drop',
      priority: 'MEDIUM',
      reporter_id: admin.id,
      assignee_id: admin.id,
      sprint_id: sprint.id,
      workflow_status_id: statusFor(ItemType.STORY, 'A FAZER').id,
      parent_id: parentItem?.id ?? null,
    },
  });

  await prisma.item.create({
    data: {
      project_id: project.id,
      project_key: 'MINI-3',
      type: ItemType.BUG,
      title: 'Erro de CORS no MinIO',
      priority: 'CRITICAL',
      reporter_id: admin.id,
      assignee_id: admin.id,
      sprint_id: sprint.id,
      workflow_status_id: statusFor(ItemType.BUG, 'Em correção').id,
    },
  });

  console.log('Database successfully populated!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
