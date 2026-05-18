import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/db';

const bugFeatureSelect = {
  id: true,
  name: true,
  description: true,
  system_id: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  system: { select: { id: true, name: true, active: true } },
} as const;

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

async function ensureSystemExists(systemId: string) {
  return prisma.bugSystem.findUnique({
    where: { id: systemId },
    select: { id: true },
  });
}

export class BugFeaturesController {
  async list(req: any, res: Response) {
    const active = parseBoolean(req.query.active);
    const systemId = normalizeText(req.query.system_id);

    const where: Prisma.BugFeatureWhereInput = {};
    if (active !== undefined) where.active = active;
    if (systemId) where.system_id = systemId;

    const features = await prisma.bugFeature.findMany({
      where,
      select: bugFeatureSelect,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    res.json(features);
  }

  async create(req: any, res: Response) {
    const systemId = normalizeText(req.body.system_id);
    const name = normalizeText(req.body.name);
    const description = normalizeText(req.body.description) || null;
    const active = parseBoolean(req.body.active);

    if (!systemId) {
      return res.status(400).json({ error: 'Sistema é obrigatório' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Nome da funcionalidade é obrigatório' });
    }

    if (!(await ensureSystemExists(systemId))) {
      return res.status(404).json({ error: 'Sistema monitorado não encontrado' });
    }

    try {
      const feature = await prisma.bugFeature.create({
        data: {
          system_id: systemId,
          name,
          description,
          active: active ?? true,
        },
        select: bugFeatureSelect,
      });

      res.status(201).json(feature);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(400).json({ error: 'Já existe uma funcionalidade com este nome neste sistema' });
      }
      throw error;
    }
  }

  async update(req: any, res: Response) {
    const { id } = req.params;
    const systemId = normalizeText(req.body.system_id);
    const name = normalizeText(req.body.name);
    const description = normalizeText(req.body.description) || null;
    const active = parseBoolean(req.body.active);

    if (!systemId) {
      return res.status(400).json({ error: 'Sistema é obrigatório' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Nome da funcionalidade é obrigatório' });
    }

    if (!(await ensureSystemExists(systemId))) {
      return res.status(404).json({ error: 'Sistema monitorado não encontrado' });
    }

    try {
      const feature = await prisma.bugFeature.update({
        where: { id },
        data: {
          system_id: systemId,
          name,
          description,
          ...(active === undefined ? {} : { active }),
        },
        select: bugFeatureSelect,
      });

      res.json(feature);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return res.status(400).json({ error: 'Já existe uma funcionalidade com este nome neste sistema' });
        }
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Funcionalidade não encontrada' });
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
      const feature = await prisma.bugFeature.update({
        where: { id },
        data: { active },
        select: bugFeatureSelect,
      });

      res.json(feature);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ error: 'Funcionalidade não encontrada' });
      }
      throw error;
    }
  }

  async delete(req: any, res: Response) {
    const { id } = req.params;

    try {
      await prisma.bugFeature.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Funcionalidade não encontrada' });
        }
        if (error.code === 'P2003') {
          return res.status(400).json({ error: 'Não é possível excluir uma funcionalidade com bugs vinculados. Inative a funcionalidade.' });
        }
      }
      throw error;
    }
  }
}
