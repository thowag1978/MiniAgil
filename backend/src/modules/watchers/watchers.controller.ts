import type { Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { canViewProject } from '../../services/permissions';
import { followItem, unfollowItem } from '../../services/itemWatchers';

async function accessibleItem(itemId: string, userId: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, project_id: true },
  });
  if (!item || !(await canViewProject(userId, item.project_id))) return null;
  return item;
}

export class WatchersController {
  async list(req: any, res: Response) {
    const item = await accessibleItem(req.params.itemId, req.user.id);
    if (!item) return res.status(404).json({ error: 'Item not found or access denied' });

    const watchers = await prisma.itemWatcher.findMany({
      where: { item_id: item.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(watchers);
  }

  async follow(req: any, res: Response) {
    const item = await accessibleItem(req.params.itemId, req.user.id);
    if (!item) return res.status(404).json({ error: 'Item not found or access denied' });

    const result = await prisma.$transaction((tx) => followItem(tx, item, req.user.id));
    res.status(result.created ? 201 : 200).json(result.watcher);
  }

  async unfollow(req: any, res: Response) {
    const item = await accessibleItem(req.params.itemId, req.user.id);
    if (!item) return res.status(404).json({ error: 'Item not found or access denied' });

    await prisma.$transaction((tx) => unfollowItem(tx, item, req.user.id));
    res.status(204).send();
  }
}
