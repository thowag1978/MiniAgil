import { Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { canViewProject } from '../../services/permissions';
import { listItemHistory } from '../../services/itemHistory';

function parsePagination(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export class ItemHistoryController {
  async list(req: any, res: Response) {
    const page = parsePagination(req.query.page, 1);
    const requestedLimit = parsePagination(req.query.limit, 20);
    if (!page || !requestedLimit || requestedLimit > 100) {
      return res.status(400).json({ error: 'Page and limit must be positive integers, with limit up to 100' });
    }

    const item = await prisma.item.findUnique({
      where: { id: req.params.itemId },
      select: { id: true, project_id: true },
    });

    if (!item || !(await canViewProject(req.user.id, item.project_id))) {
      return res.status(404).json({ error: 'Item not found or access denied' });
    }

    const { data, total } = await listItemHistory(item.id, page, requestedLimit);
    res.json({
      data,
      pagination: {
        page,
        limit: requestedLimit,
        total,
        totalPages: Math.ceil(total / requestedLimit),
      },
    });
  }
}
