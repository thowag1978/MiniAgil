import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/db';

const bugSystemSelect = {
  id: true,
  name: true,
  description: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

function normalizeName(name: unknown): string {
  return typeof name === 'string' ? name.trim() : '';
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
}

export class BugSystemsController {
  async list(req: any, res: Response) {
    const active = parseBoolean(req.query.active);

    const systems = await prisma.bugSystem.findMany({
      where: active === undefined ? {} : { active },
      select: bugSystemSelect,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    res.json(systems);
  }

  async create(req: any, res: Response) {
    const name = normalizeName(req.body.name);
    const description = typeof req.body.description === 'string' && req.body.description.trim()
      ? req.body.description.trim()
      : null;
    const active = parseBoolean(req.body.active);

    if (!name) {
      return res.status(400).json({ error: 'Nome do sistema é obrigatório' });
    }

    try {
      const system = await prisma.bugSystem.create({
        data: {
          name,
          description,
          active: active ?? true,
        },
        select: bugSystemSelect,
      });

      res.status(201).json(system);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(400).json({ error: 'Já existe um sistema monitorado com este nome' });
      }
      throw error;
    }
  }

  async update(req: any, res: Response) {
    const { id } = req.params;
    const name = normalizeName(req.body.name);
    const description = typeof req.body.description === 'string' && req.body.description.trim()
      ? req.body.description.trim()
      : null;
    const active = parseBoolean(req.body.active);

    if (!name) {
      return res.status(400).json({ error: 'Nome do sistema é obrigatório' });
    }

    try {
      const system = await prisma.bugSystem.update({
        where: { id },
        data: {
          name,
          description,
          ...(active === undefined ? {} : { active }),
        },
        select: bugSystemSelect,
      });

      res.json(system);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return res.status(400).json({ error: 'Já existe um sistema monitorado com este nome' });
        }
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Sistema monitorado não encontrado' });
        }
      }
      throw error;
    }
  }

  async updateActive(req: any, res: Response) {
    const { id } = req.params;
    const active = parseBoolean(req.body.active);

    if (active === undefined) {
      return res.status(400).json({ error: 'Campo ativo deve ser verdadeiro ou falso' });
    }

    try {
      const system = await prisma.bugSystem.update({
        where: { id },
        data: { active },
        select: bugSystemSelect,
      });

      res.json(system);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ error: 'Sistema monitorado não encontrado' });
      }
      throw error;
    }
  }

  async delete(req: any, res: Response) {
    const { id } = req.params;

    try {
      await prisma.bugSystem.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Sistema monitorado não encontrado' });
        }
        if (error.code === 'P2003') {
          return res.status(400).json({ error: 'Não é possível excluir um sistema com funcionalidades ou bugs vinculados. Inative o sistema.' });
        }
      }
      throw error;
    }
  }
}
