import { ItemHistoryEvent, Prisma } from '@prisma/client';
import { prisma as prismaHistoryClient } from '../infrastructure/db';
import { createNotificationsForHistoryEvent } from './notifications';

type HistoryTransaction = Prisma.TransactionClient;

type EntityValue = {
  id: string;
  name: string;
} | null;

export type ItemHistorySnapshot = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: string;
  estimate: number | null;
  story_points: number | null;
  acceptance_criteria: string | null;
  workflow_status: EntityValue;
  assignee: EntityValue;
  sprint: EntityValue;
};

export type RecordHistoryInput = {
  itemId: string;
  projectId: string;
  userId: string;
  eventType: ItemHistoryEvent;
  field?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

function scalarValue(value: string | number | null) {
  return { value };
}

function entityValue(value: EntityValue) {
  return value ? { id: value.id, name: value.name } : { id: null, name: null };
}

export async function recordItemHistory(tx: HistoryTransaction, input: RecordHistoryInput) {
  const data: Prisma.ItemHistoryUncheckedCreateInput = {
    item_id: input.itemId,
    project_id: input.projectId,
    user_id: input.userId,
    event_type: input.eventType,
    field: input.field ?? null,
  };
  if (input.oldValue !== undefined) data.old_value = input.oldValue;
  if (input.newValue !== undefined) data.new_value = input.newValue;
  if (input.metadata !== undefined) data.metadata = input.metadata;

  const history = await tx.itemHistory.create({
    data,
  });
  await createNotificationsForHistoryEvent(tx, history.id, input);
  return history;
}

export async function recordItemCreated(
  tx: HistoryTransaction,
  item: { id: string; project_id: string; project_key: string; type: string; title: string },
  userId: string,
) {
  return recordItemHistory(tx, {
    itemId: item.id,
    projectId: item.project_id,
    userId,
    eventType: ItemHistoryEvent.ITEM_CREATED,
    newValue: { id: item.id, project_key: item.project_key, type: item.type, title: item.title },
  });
}

export async function recordItemChanges(
  tx: HistoryTransaction,
  before: ItemHistorySnapshot,
  after: ItemHistorySnapshot,
  userId: string,
) {
  const events: Array<Omit<RecordHistoryInput, 'itemId' | 'projectId' | 'userId'>> = [];

  if (before.title !== after.title) {
    events.push({ eventType: ItemHistoryEvent.TITLE_CHANGED, field: 'title', oldValue: scalarValue(before.title), newValue: scalarValue(after.title) });
  }
  if (before.description !== after.description) {
    events.push({ eventType: ItemHistoryEvent.DESCRIPTION_CHANGED, field: 'description', oldValue: scalarValue(before.description), newValue: scalarValue(after.description) });
  }
  if (before.workflow_status?.id !== after.workflow_status?.id) {
    events.push({ eventType: ItemHistoryEvent.STATUS_CHANGED, field: 'workflow_status_id', oldValue: entityValue(before.workflow_status), newValue: entityValue(after.workflow_status) });
  }
  if (before.priority !== after.priority) {
    events.push({ eventType: ItemHistoryEvent.PRIORITY_CHANGED, field: 'priority', oldValue: scalarValue(before.priority), newValue: scalarValue(after.priority) });
  }
  if (before.assignee?.id !== after.assignee?.id) {
    events.push({ eventType: ItemHistoryEvent.ASSIGNEE_CHANGED, field: 'assignee_id', oldValue: entityValue(before.assignee), newValue: entityValue(after.assignee) });
  }
  if (before.sprint?.id !== after.sprint?.id) {
    events.push({ eventType: ItemHistoryEvent.SPRINT_CHANGED, field: 'sprint_id', oldValue: entityValue(before.sprint), newValue: entityValue(after.sprint) });
  }
  if (before.estimate !== after.estimate) {
    events.push({ eventType: ItemHistoryEvent.ESTIMATE_CHANGED, field: 'estimate', oldValue: scalarValue(before.estimate), newValue: scalarValue(after.estimate) });
  }
  if (before.story_points !== after.story_points) {
    events.push({ eventType: ItemHistoryEvent.ESTIMATE_CHANGED, field: 'story_points', oldValue: scalarValue(before.story_points), newValue: scalarValue(after.story_points) });
  }
  if (before.acceptance_criteria !== after.acceptance_criteria) {
    events.push({ eventType: ItemHistoryEvent.ACCEPTANCE_CRITERIA_CHANGED, field: 'acceptance_criteria', oldValue: scalarValue(before.acceptance_criteria), newValue: scalarValue(after.acceptance_criteria) });
  }

  for (const event of events) {
    await recordItemHistory(tx, {
      ...event,
      itemId: after.id,
      projectId: after.project_id,
      userId,
    });
  }
}

export async function recordCommentHistory(
  tx: HistoryTransaction,
  input: {
    itemId: string;
    projectId: string;
    userId: string;
    commentId: string;
    eventType: 'COMMENT_CREATED' | 'COMMENT_EDITED' | 'COMMENT_DELETED';
    oldText?: string;
    newText?: string;
  },
) {
  const history: RecordHistoryInput = {
    itemId: input.itemId,
    projectId: input.projectId,
    userId: input.userId,
    eventType: input.eventType,
    field: 'comment',
    metadata: { comment_id: input.commentId },
  };
  if (input.oldText !== undefined) history.oldValue = { text: input.oldText };
  if (input.newText !== undefined) history.newValue = { text: input.newText };
  return recordItemHistory(tx, history);
}

export async function recordAttachmentHistory(
  tx: HistoryTransaction,
  input: {
    itemId: string;
    projectId: string;
    userId: string;
    attachmentId: string;
    eventType: 'ATTACHMENT_UPLOADED' | 'ATTACHMENT_DOWNLOADED' | 'ATTACHMENT_DELETED';
    fileName: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
  },
) {
  return recordItemHistory(tx, {
    itemId: input.itemId,
    projectId: input.projectId,
    userId: input.userId,
    eventType: input.eventType,
    field: 'attachment',
    metadata: {
      attachment_id: input.attachmentId,
      file_name: input.fileName,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes ?? null,
    },
  });
}

export async function listItemHistory(itemId: string, page: number, limit: number) {
  const where = { item_id: itemId };
  const [data, total] = await Promise.all([
    prismaHistoryClient.itemHistory.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prismaHistoryClient.itemHistory.count({ where }),
  ]);

  return { data, total };
}
