import { ItemHistoryEvent, Prisma } from '@prisma/client';
import { recordItemHistory } from './itemHistory';

type WatcherTransaction = Prisma.TransactionClient;

export async function followItem(
  tx: WatcherTransaction,
  item: { id: string; project_id: string },
  userId: string,
  actorId = userId,
) {
  const existing = await tx.itemWatcher.findUnique({
    where: { item_id_user_id: { item_id: item.id, user_id: userId } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (existing) return { watcher: existing, created: false };

  const watcher = await tx.itemWatcher.create({
    data: { item_id: item.id, user_id: userId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  await recordItemHistory(tx, {
    itemId: item.id,
    projectId: item.project_id,
    userId: actorId,
    eventType: ItemHistoryEvent.WATCHER_ADDED,
    field: 'watcher',
    metadata: { watcher_user_id: userId },
  });
  return { watcher, created: true };
}

export async function unfollowItem(
  tx: WatcherTransaction,
  item: { id: string; project_id: string },
  userId: string,
) {
  const existing = await tx.itemWatcher.findUnique({
    where: { item_id_user_id: { item_id: item.id, user_id: userId } },
  });
  if (!existing) return false;

  await tx.itemWatcher.delete({ where: { id: existing.id } });
  await recordItemHistory(tx, {
    itemId: item.id,
    projectId: item.project_id,
    userId,
    eventType: ItemHistoryEvent.WATCHER_REMOVED,
    field: 'watcher',
    metadata: { watcher_user_id: userId },
  });
  return true;
}
