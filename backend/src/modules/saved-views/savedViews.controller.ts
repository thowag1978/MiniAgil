import { Prisma, SavedViewType } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { canViewProject } from '../../services/permissions';
import { filtersJson, InvalidSavedViewFiltersError, normalizeKanbanFilters } from '../../services/savedViewFilters';

function knownError(error: unknown, res: Response) {
  if (error instanceof InvalidSavedViewFiltersError) return res.status(400).json({ error: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'A saved view with this name already exists' });
  throw error;
}

export class SavedViewsController {
  list = async (req: any, res: Response) => {
    if (!(await canViewProject(req.user.id, req.params.projectId))) return res.status(404).json({ error: 'Project not found' });
    const views = await prisma.savedView.findMany({
      where: { user_id: req.user.id, project_id: req.params.projectId, view_type: SavedViewType.KANBAN },
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });
    res.json(views);
  };

  create = async (req: any, res: Response) => {
    if (!(await canViewProject(req.user.id, req.params.projectId))) return res.status(404).json({ error: 'Project not found' });
    const name = String(req.body.name ?? '').trim();
    if (!name || name.length > 100) return res.status(400).json({ error: 'View name is required and must have at most 100 characters' });
    try {
      const filters = normalizeKanbanFilters(req.body.filters ?? {});
      const view = await prisma.$transaction(async (tx) => {
        if (req.body.is_default === true) await tx.savedView.updateMany({
          where: { user_id: req.user.id, project_id: req.params.projectId, view_type: SavedViewType.KANBAN }, data: { is_default: false },
        });
        return tx.savedView.create({
          data: { user_id: req.user.id, project_id: req.params.projectId, name, view_type: SavedViewType.KANBAN, filters: filtersJson(filters), is_default: req.body.is_default === true },
        });
      });
      res.status(201).json(view);
    } catch (error) { return knownError(error, res); }
  };

  update = async (req: any, res: Response) => {
    const existing = await prisma.savedView.findFirst({ where: { id: req.params.id, user_id: req.user.id } });
    if (!existing) return res.status(404).json({ error: 'Saved view not found' });
    try {
      const data: Prisma.SavedViewUpdateInput = {};
      if (req.body.name !== undefined) {
        const name = String(req.body.name).trim();
        if (!name || name.length > 100) return res.status(400).json({ error: 'Invalid view name' });
        data.name = name;
      }
      if (req.body.filters !== undefined) data.filters = filtersJson(normalizeKanbanFilters(req.body.filters));
      if (req.body.is_default !== undefined) {
        if (typeof req.body.is_default !== 'boolean') return res.status(400).json({ error: 'is_default must be boolean' });
        data.is_default = req.body.is_default;
      }
      const updated = await prisma.$transaction(async (tx) => {
        if (req.body.is_default === true) await tx.savedView.updateMany({
          where: { user_id: req.user.id, project_id: existing.project_id, view_type: existing.view_type, id: { not: existing.id } }, data: { is_default: false },
        });
        return tx.savedView.update({ where: { id: existing.id }, data });
      });
      res.json(updated);
    } catch (error) { return knownError(error, res); }
  };

  delete = async (req: any, res: Response) => {
    const existing = await prisma.savedView.findFirst({ where: { id: req.params.id, user_id: req.user.id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Saved view not found' });
    await prisma.savedView.delete({ where: { id: existing.id } });
    res.status(204).send();
  };
}
