import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/db';

export class ItemsController {
  async create(req: any, res: Response) {
    const { type, title, description, priority, project_id, sprint_id, parent_id, workflow_status_id } = req.body;

    if (!type || !title || !project_id || !workflow_status_id) {
      return res.status(400).json({ error: 'Type, title, project_id, and workflow_status_id are required' });
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
        workflow_status_id
      }
    });

    res.status(201).json(item);
  }

  async list(req: any, res: Response) {
    const { project_id, sprint_id, type } = req.query;

    const items = await prisma.item.findMany({
      where: {
        project_id: project_id ? String(project_id) : undefined,
        sprint_id: sprint_id ? String(sprint_id) : undefined,
        type: type ? (type as any) : undefined
      },
      include: {
        assignee: { select: { name: true, email: true } },
        reporter: { select: { name: true } },
        workflow_status: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(items);
  }

  async updateField(req: any, res: Response) {
    const { id } = req.params;
    const { workflow_status_id, assignee_id, sprint_id, priority, title, description } = req.body;

    const data: any = {};
    if (workflow_status_id !== undefined) data.workflow_status_id = workflow_status_id;
    if (assignee_id !== undefined) data.assignee_id = assignee_id;
    if (sprint_id !== undefined) data.sprint_id = sprint_id;
    if (priority !== undefined) data.priority = priority;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;

    // Handle clearing sprint (sending null)
    if (sprint_id === null) data.sprint_id = null;
    
    // Handle clearing assignee
    if (assignee_id === null) data.assignee_id = null;

    const updated = await prisma.item.update({
        where: { id },
        data,
        include: { workflow_status: true, assignee: true }
    });

    res.json(updated);
  }
}
