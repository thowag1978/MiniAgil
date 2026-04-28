import { Request, Response } from 'express';
import { SprintStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/db';

export class SprintsController {
  async create(req: any, res: Response) {
    const { name, goal, startDate, endDate, project_id } = req.body;
    
    if (!name || !project_id) {
      return res.status(400).json({ error: 'Name and project_id are required' });
    }

    const project = await prisma.project.findFirst({
      where: { id: project_id, members: { some: { user_id: req.user.id } } }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const sprint = await prisma.sprint.create({
      data: { name, goal, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, project_id }
    });
    
    res.status(201).json(sprint);
  }

  async list(req: any, res: Response) {
    const { project_id } = req.query;

    if (!project_id) {
       return res.status(400).json({ error: 'project_id query param is required' });
    }

    const sprints = await prisma.sprint.findMany({
      where: {
        project_id: String(project_id),
        project: { members: { some: { user_id: req.user.id } } }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(sprints);
  }

  async updateStatus(req: any, res: Response) {
    const { id } = req.params;
    const { status } = req.body; // PLANNED, ACTIVE, CLOSED

    const normalizedStatus = String(status || '').toUpperCase();
    if (!['PLANNED', 'ACTIVE', 'CLOSED'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid sprint status' });
    }

    const sprint = await prisma.sprint.findFirst({
      where: { id, project: { members: { some: { user_id: req.user.id } } } },
      select: { id: true }
    });

    if (!sprint) {
      return res.status(404).json({ error: 'Sprint not found or access denied' });
    }

    const updated = await prisma.sprint.update({
      where: { id: sprint.id },
      data: { status: normalizedStatus as SprintStatus }
    });
    res.json(updated);
  }
}
