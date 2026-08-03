import { ItemHistoryEvent, NotificationType, Prisma, Role } from '@prisma/client';

type NotificationTransaction = Prisma.TransactionClient;

type HistoryEventInput = {
  itemId: string;
  projectId: string;
  userId: string;
  eventType: ItemHistoryEvent;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

function objectString(value: Prisma.InputJsonValue | undefined, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate : null;
}

export async function createNotificationsForHistoryEvent(
  tx: NotificationTransaction,
  historyId: string,
  event: HistoryEventInput,
) {
  let type: NotificationType | null = null;
  let recipientIds: string[] = [];

  if (event.eventType === ItemHistoryEvent.ASSIGNEE_CHANGED) {
    type = NotificationType.ITEM_ASSIGNED;
    const assigneeId = objectString(event.newValue, 'id');
    if (assigneeId) recipientIds = [assigneeId];
  } else if (
    event.eventType === ItemHistoryEvent.COMMENT_CREATED
    || event.eventType === ItemHistoryEvent.STATUS_CHANGED
  ) {
    type = event.eventType === ItemHistoryEvent.COMMENT_CREATED
      ? NotificationType.COMMENT_CREATED
      : NotificationType.STATUS_CHANGED;
    const watchers = await tx.itemWatcher.findMany({
      where: { item_id: event.itemId },
      select: { user_id: true },
    });
    recipientIds = watchers.map((watcher) => watcher.user_id);
  } else if (event.eventType === ItemHistoryEvent.WATCHER_ADDED) {
    type = NotificationType.WATCHER_ADDED;
    const watcherId = objectString(event.metadata, 'watcher_user_id');
    if (watcherId) recipientIds = [watcherId];
  }

  recipientIds = [...new Set(recipientIds)].filter((id) => id !== event.userId);
  if (!type || recipientIds.length === 0) return;

  const [item, allowedUsers] = await Promise.all([
    tx.item.findUnique({
      where: { id: event.itemId },
      select: { project_key: true, title: true },
    }),
    tx.user.findMany({
      where: {
        id: { in: recipientIds },
        OR: [
          { role: Role.ADMIN },
          { ownedProjects: { some: { id: event.projectId } } },
          { projects: { some: { project_id: event.projectId } } },
          { teams: { some: { team: { projects: { some: { project_id: event.projectId } } } } } },
        ],
      },
      select: { id: true },
    }),
  ]);
  if (!item || allowedUsers.length === 0) return;

  const statusName = objectString(event.newValue, 'name');
  const message = type === NotificationType.ITEM_ASSIGNED
    ? `Você foi atribuído ao item ${item.project_key} - ${item.title}.`
    : type === NotificationType.COMMENT_CREATED
      ? `Um novo comentário foi adicionado ao item ${item.project_key} - ${item.title}.`
      : type === NotificationType.STATUS_CHANGED
        ? `O status do item ${item.project_key} foi alterado${statusName ? ` para ${statusName}` : ''}.`
        : `Você começou a seguir o item ${item.project_key} - ${item.title}.`;

  await tx.notification.createMany({
    data: allowedUsers.map(({ id }) => ({
      user_id: id,
      actor_id: event.userId,
      project_id: event.projectId,
      item_id: event.itemId,
      history_id: historyId,
      type,
      message: message.slice(0, 191),
      metadata: { event_type: event.eventType },
    })),
  });
}
