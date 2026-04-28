import { Request, Response } from 'express';
import { SprintStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/db';

function projectAccessWhere(userId: string, role?: string) {
  return role === 'ADMIN'
    ? {}
    : {
        OR: [
          { owner_id: userId },
          { members: { some: { user_id: userId } } },
        ],
      };
}

export class SprintsController {
  async create(req: any, res: Response) {
    const { name, goal, startDate, endDate, project_id } = req.body;
    
    if (!name || !project_id) {
      return res.status(400).json({ error: 'Name and project_id are required' });
    }

    const project = await prisma.project.findFirst({
      where: { id: project_id, ...projectAccessWhere(req.user.id, req.user.role) }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;
    if ((parsedStartDate && Number.isNaN(parsedStartDate.getTime())) || (parsedEndDate && Number.isNaN(parsedEndDate.getTime()))) {
      return res.status(400).json({ error: 'Invalid sprint dates' });
    }
    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
      return res.status(400).json({ error: 'Sprint end date must be after start date' });
    }

    const sprint = await prisma.sprint.create({
      data: { name, goal, startDate: parsedStartDate, endDate: parsedEndDate, project_id }
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
        project: projectAccessWhere(req.user.id, req.user.role)
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
      where: { id, project: projectAccessWhere(req.user.id, req.user.role) },
      select: { id: true, project_id: true }
    });

    if (!sprint) {
      return res.status(404).json({ error: 'Sprint not found or access denied' });
    }

    if (normalizedStatus === 'ACTIVE') {
      const activeSprint = await prisma.sprint.findFirst({
        where: {
          id: { not: id },
          status: 'ACTIVE',
          project_id: sprint.project_id,
        },
        select: { id: true },
      });

      if (activeSprint) {
        return res.status(400).json({ error: 'Project already has an active sprint' });
      }
    }

    const updated = await prisma.sprint.update({
      where: { id: sprint.id },
      data: { status: normalizedStatus as SprintStatus }
    });
    res.json(updated);
  }
}
