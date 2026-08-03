import type { Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { getProjectAccessWhere } from '../../services/permissions';

function positiveInteger(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const notificationInclude = {
  actor: { select: { id: true, name: true, email: true } },
  item: { select: { id: true, project_key: true, title: true } },
  project: { select: { id: true, name: true, key_prefix: true } },
} as const;

export class NotificationsController {
  async list(req: any, res: Response) {
    const page = positiveInteger(req.query.page, 1);
    const limit = positiveInteger(req.query.limit, 20);
    if (!page || !limit || limit > 100) {
      return res.status(400).json({ error: 'Page and limit must be positive integers, with limit up to 100' });
    }
    const projectAccess = await getProjectAccessWhere(req.user.id);
    const where = { user_id: req.user.id, project: projectAccess };
    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: notificationInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);
    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  async unreadCount(req: any, res: Response) {
    const projectAccess = await getProjectAccessWhere(req.user.id);
    const count = await prisma.notification.count({
      where: { user_id: req.user.id, readAt: null, project: projectAccess },
    });
    res.json({ count });
  }

  async markRead(req: any, res: Response) {
    const projectAccess = await getProjectAccessWhere(req.user.id);
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, user_id: req.user.id, project: projectAccess },
    });
    if (!notification) return res.status(404).json({ error: 'Notification not found or access denied' });
    if (notification.readAt) return res.json(notification);

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });
    res.json(updated);
  }

  async markAllRead(req: any, res: Response) {
    const projectAccess = await getProjectAccessWhere(req.user.id);
    const result = await prisma.notification.updateMany({
      where: { user_id: req.user.id, readAt: null, project: projectAccess },
      data: { readAt: new Date() },
    });
    res.json({ updated: result.count });
  }
}
