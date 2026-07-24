import { Response } from 'express';
import { prisma } from '../../infrastructure/db';

const teamInclude = {
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  projects: {
    include: {
      project: { select: { id: true, name: true, key_prefix: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

function parseIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) return null;
  return [...new Set(value.map((id) => id.trim()).filter(Boolean))];
}

async function ensureAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === 'ADMIN';
}

async function validateRelations(userIds: string[], projectIds: string[]) {
  const [userCount, projectCount] = await Promise.all([
    prisma.user.count({ where: { id: { in: userIds } } }),
    prisma.project.count({ where: { id: { in: projectIds } } }),
  ]);
  return userCount === userIds.length && projectCount === projectIds.length;
}

export class TeamsController {
  async list(req: any, res: Response) {
    if (!(await ensureAdmin(req.user.id))) {
      return res.status(403).json({ error: 'Acesso negado: somente administradores.' });
    }

    const teams = await prisma.team.findMany({
      include: teamInclude,
      orderBy: { name: 'asc' },
    });
    res.json(teams);
  }

  async create(req: any, res: Response) {
    if (!(await ensureAdmin(req.user.id))) {
      return res.status(403).json({ error: 'Acesso negado: somente administradores.' });
    }

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;
    const userIds = parseIds(req.body.user_ids);
    const projectIds = parseIds(req.body.project_ids);

    if (!name || userIds === null || projectIds === null) {
      return res.status(400).json({ error: 'Nome, usuários e projetos devem ser informados corretamente.' });
    }
    if (!(await validateRelations(userIds, projectIds))) {
      return res.status(400).json({ error: 'Um ou mais usuários ou projetos não existem.' });
    }

    try {
      const team = await prisma.team.create({
        data: {
          name,
          description: description || null,
          members: { create: userIds.map((user_id) => ({ user_id })) },
          projects: { create: projectIds.map((project_id) => ({ project_id })) },
        },
        include: teamInclude,
      });
      res.status(201).json(team);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Já existe uma equipe com esse nome.' });
      }
      throw error;
    }
  }

  async update(req: any, res: Response) {
    if (!(await ensureAdmin(req.user.id))) {
      return res.status(403).json({ error: 'Acesso negado: somente administradores.' });
    }

    const { id } = req.params;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;
    const userIds = parseIds(req.body.user_ids);
    const projectIds = parseIds(req.body.project_ids);

    if (!name || userIds === null || projectIds === null) {
      return res.status(400).json({ error: 'Nome, usuários e projetos devem ser informados corretamente.' });
    }
    if (!(await validateRelations(userIds, projectIds))) {
      return res.status(400).json({ error: 'Um ou mais usuários ou projetos não existem.' });
    }

    const existing = await prisma.team.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Equipe não encontrada.' });

    try {
      const team = await prisma.$transaction(async (tx) => {
        await tx.teamMember.deleteMany({ where: { team_id: id } });
        await tx.teamProject.deleteMany({ where: { team_id: id } });
        return tx.team.update({
          where: { id },
          data: {
            name,
            description: description || null,
            members: { create: userIds.map((user_id) => ({ user_id })) },
            projects: { create: projectIds.map((project_id) => ({ project_id })) },
          },
          include: teamInclude,
        });
      });
      res.json(team);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Já existe uma equipe com esse nome.' });
      }
      throw error;
    }
  }

  async delete(req: any, res: Response) {
    if (!(await ensureAdmin(req.user.id))) {
      return res.status(403).json({ error: 'Acesso negado: somente administradores.' });
    }

    const existing = await prisma.team.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Equipe não encontrada.' });

    await prisma.team.delete({ where: { id: existing.id } });
    res.status(204).send();
  }
}
