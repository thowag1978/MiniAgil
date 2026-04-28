import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/db';

export class ItemsController {
  async create(req: any, res: Response) {
    const { type, title, description, priority, project_id, sprint_id, parent_id, workflow_status_id, acceptance_criteria, estimate } = req.body;

    if (!type || !title || !project_id || !workflow_status_id) {
      return res.status(400).json({ error: 'Type, title, project_id, and workflow_status_id are required' });
    }

    // Rules for hierarchy
    if (type === 'STORY') {
      if (!parent_id) return res.status(400).json({ error: 'História de Usuário deve ter um Épico vinculado' });
      const parent = await prisma.item.findUnique({ where: { id: parent_id } });
      if (!parent || parent.type !== 'EPIC') return res.status(400).json({ error: 'O item pai deve ser um Épico válido' });
    }

    if (type === 'TASK') {
      if (!parent_id) return res.status(400).json({ error: 'Atividade deve ter uma História vinculada' });
      const parent = await prisma.item.findUnique({ where: { id: parent_id } });
      if (!parent || parent.type !== 'STORY') return res.status(400).json({ error: 'O item pai deve ser uma História válida' });
    }

    const project = await prisma.project.findUnique({ where: { id: project_id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Sequence Generator (Ex: PROJ-1)
    const count = await prisma.item.count({ where: { project_id } });
    const project_key = `${project.key_prefix}-${count + 1}`;

    const item = await prisma.item.create({
      data: {
        project_key,
        type,
        title,
        description,
        priority: priority || 'MEDIUM',
        reporter_id: req.user.id,
        project_id,
        sprint_id,
        parent_id,
        workflow_status_id,
        acceptance_criteria,
        estimate: estimate ? parseInt(estimate) : null
      }
    });

    res.status(201).json(item);
  }

  async list(req: any, res: Response) {
    const { project_id, sprint_id, type } = req.query;
    const where: Prisma.ItemWhereInput = {};

    if (project_id) where.project_id = String(project_id);
    if (sprint_id) where.sprint_id = String(sprint_id);
    if (type) where.type = type as any;

    const items = await prisma.item.findMany({
      where,
      include: {
        assignee: { select: { name: true, email: true } },
        reporter: { select: { name: true } },
        project: { select: { id: true, name: true, key_prefix: true } },
        workflow_status: true,
        parent: { select: { id: true, title: true, project_key: true, type: true } },
        children: { select: { id: true, title: true, project_key: true, type: true, workflow_status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(items);
  }

  async updateField(req: any, res: Response) {
    const { id } = req.params;
    const { workflow_status_id, assignee_id, sprint_id, priority, title, description, parent_id, acceptance_criteria, estimate } = req.body;

    const data: any = {};
    if (workflow_status_id !== undefined) data.workflow_status_id = workflow_status_id;
    if (assignee_id !== undefined) data.assignee_id = assignee_id;
    if (sprint_id !== undefined) data.sprint_id = sprint_id;
    if (priority !== undefined) data.priority = priority;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (parent_id !== undefined) data.parent_id = parent_id;
    if (acceptance_criteria !== undefined) data.acceptance_criteria = acceptance_criteria;
    if (estimate !== undefined) data.estimate = estimate ? parseInt(estimate) : null;

    // Handle clearing sprint (sending null)
    if (sprint_id === null) data.sprint_id = null;
    
    // Handle clearing assignee
    if (assignee_id === null) data.assignee_id = null;

    // Handle clearing parent
    if (parent_id === null) data.parent_id = null;

    const updated = await prisma.item.update({
        where: { id },
        data,
        include: { 
          workflow_status: true, 
          assignee: true,
          parent: { select: { id: true, title: true, project_key: true, type: true } },
          children: { select: { id: true, title: true, project_key: true, type: true, workflow_status: true } }
        }
    });

    res.json(updated);
  }

  async listStatuses(req: Request, res: Response) {
    const statuses = await prisma.workflowStatus.findMany({ orderBy: { order: 'asc' } });
    res.json(statuses);
  }

  async listHierarchical(req: any, res: Response) {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const epics = await prisma.item.findMany({
      where: {
        project_id: String(project_id),
        type: 'EPIC'
      },
      include: {
        assignee: { select: { name: true, email: true } },
        workflow_status: true,
        children: {
          include: {
            assignee: { select: { name: true, email: true } },
            workflow_status: true,
            children: {
              include: {
                assignee: { select: { name: true, email: true } },
                workflow_status: true,
              },
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(epics);
  }

  async delete(req: any, res: Response) {
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } }
    });

    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (item._count.children > 0) {
      return res.status(400).json({ error: 'Não é possível excluir um item que possui filhos vinculados.' });
    }

    await prisma.item.delete({ where: { id } });
    res.json({ success: true });
  }
}
