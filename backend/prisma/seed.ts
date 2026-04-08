import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Workflows
  const sTodo = await prisma.workflowStatus.upsert({
    where: { name: 'A FAZER' }, update: {}, create: { name: 'A FAZER', order: 10 }
  });
  const sProg = await prisma.workflowStatus.upsert({
    where: { name: 'EM PROGRESSO' }, update: {}, create: { name: 'EM PROGRESSO', order: 20 }
  });
  const sReview = await prisma.workflowStatus.upsert({
    where: { name: 'PARA REVISÃO' }, update: {}, create: { name: 'PARA REVISÃO', order: 30 }
  });
  const sDone = await prisma.workflowStatus.upsert({
    where: { name: 'CONCLUÍDO' }, update: {}, create: { name: 'CONCLUÍDO', order: 40 }
  });

  // 2. Create Default Admin User
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@miniagil.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@miniagil.com', password: hashedPassword, role: 'ADMIN' },
  });

  // 3. Create Project
  const project = await prisma.project.upsert({
    where: { key_prefix: 'MINI' },
    update: {},
    create: { 
      name: 'MiniAgil Platform HQ', 
      key_prefix: 'MINI', 
      description: 'The internal project management hub',
      owner_id: admin.id,
      members: { create: { user_id: admin.id, role: 'OWNER' } }
    },
  });

  // 4. Create an active Sprint
  const sprint = await prisma.sprint.create({
    data: { project_id: project.id, name: 'Sprint 1 - Launch V1', status: 'ACTIVE' }
  });

  // 5. Create some Items for the Kanban
  await prisma.item.create({
    data: {
      project_id: project.id, project_key: 'MINI-1', type: 'EPIC',
      title: 'Estruturação Core da Plataforma', priority: 'HIGH',
      reporter_id: admin.id, workflow_status_id: sDone.id,
    }
  });

  const parentItem = await prisma.item.findUnique({ where: { project_key: 'MINI-1' } });

  await prisma.item.create({
    data: {
      project_id: project.id, project_key: 'MINI-2', type: 'STORY',
      title: 'Habilitar Kanban Drag & Drop', priority: 'MEDIUM',
      reporter_id: admin.id, assignee_id: admin.id, sprint_id: sprint.id,
      workflow_status_id: sTodo.id, parent_id: parentItem ? parentItem.id : null
    }
  });

  await prisma.item.create({
    data: {
      project_id: project.id, project_key: 'MINI-3', type: 'BUG',
      title: 'Erro de CORS no MinIO', priority: 'CRITICAL',
      reporter_id: admin.id, assignee_id: admin.id, sprint_id: sprint.id,
      workflow_status_id: sProg.id,
    }
  });

  console.log('✅ Database successfully populated!');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
