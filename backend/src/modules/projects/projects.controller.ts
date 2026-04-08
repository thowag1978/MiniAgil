import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/db';

export class ProjectsController {
  async create(req: any, res: Response) {
    const { name, key_prefix, description } = req.body;
    
    if (!name || !key_prefix) {
      return res.status(400).json({ error: 'Name and key_prefix are required' });
    }

    const existing = await prisma.project.findUnique({ where: { key_prefix } });
    if (existing) {
      return res.status(400).json({ error: 'Key prefix is already in use' });
    }

    const project = await prisma.project.create({
      data: {
        name,
        key_prefix,
        description,
        owner_id: req.user.id,
        members: {
          create: {
            user_id: req.user.id,
            role: 'OWNER'
          }
        }
      }
    });

    res.status(201).json(project);
  }

  async list(req: any, res: Response) {
    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: { user_id: req.user.id }
        }
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    });
    res.json(projects);
  }

  async getById(req: any, res: Response) {
    const { id } = req.params;
    const project = await prisma.project.findFirst({
      where: {
        id,
        members: { some: { user_id: req.user.id } }
      },
      include: {
        members: { include: { user: { select: { id: true, name: true } } } },
        sprints: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  }
}
