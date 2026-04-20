import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { ProjectRole } from '@prisma/client';

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
        OR: [
          { owner_id: req.user.id },
          { members: { some: { user_id: req.user.id } } }
        ],
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
        OR: [
          { owner_id: req.user.id },
          { members: { some: { user_id: req.user.id } } }
        ],
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

  async update(req: any, res: Response) {
    const { id } = req.params;
    const { name, key_prefix, description } = req.body;

    if (!name || !key_prefix) {
      return res.status(400).json({ error: 'Name and key_prefix are required' });
    }

    const whereAccess =
      req.user.role === 'ADMIN'
        ? { id }
        : {
            id,
            OR: [
              { owner_id: req.user.id },
              {
                members: {
                  some: {
                    user_id: req.user.id,
                    role: { in: [ProjectRole.OWNER, ProjectRole.ADMIN] },
                  },
                },
              },
            ],
          };

    const project = await prisma.project.findFirst({ where: whereAccess, select: { id: true } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const normalizedKey = String(key_prefix).toUpperCase().trim();
    const existing = await prisma.project.findFirst({
      where: {
        key_prefix: normalizedKey,
        id: { not: id },
      },
      select: { id: true },
    });
    if (existing) {
      return res.status(400).json({ error: 'Key prefix is already in use' });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        name: String(name).trim(),
        key_prefix: normalizedKey,
        description: description ?? null,
      },
    });

    res.json(updated);
  }
}
