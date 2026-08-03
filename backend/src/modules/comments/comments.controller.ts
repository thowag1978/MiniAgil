import { Response } from 'express';
import { ItemHistoryEvent } from '@prisma/client';
import { prisma } from '../../infrastructure/db';
import { canViewProject, isProjectOwnerOrAdmin } from '../../services/permissions';
import { recordCommentHistory } from '../../services/itemHistory';
import { followItem } from '../../services/itemWatchers';
import { publishDomainEvent } from '../../infrastructure/domainEvents';

const commentInclude = {
  user: { select: { id: true, name: true, email: true } },
} as const;

function commentResponse<T extends { editedAt: Date | null }>(comment: T) {
  return {
    ...comment,
    isEdited: comment.editedAt !== null,
  };
}

function parseText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text || null;
}

export class CommentsController {
  async list(req: any, res: Response) {
    const item = await prisma.item.findUnique({
      where: { id: req.params.itemId },
      select: { id: true, project_id: true },
    });

    if (!item || !(await canViewProject(req.user.id, item.project_id))) {
      return res.status(404).json({ error: 'Item not found or access denied' });
    }

    const comments = await prisma.comment.findMany({
      where: { item_id: item.id, deletedAt: null },
      include: commentInclude,
      orderBy: { createdAt: 'asc' },
    });

    res.json(comments.map(commentResponse));
  }

  async create(req: any, res: Response) {
    const text = parseText(req.body.text);
    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const item = await prisma.item.findUnique({
      where: { id: req.params.itemId },
      select: { id: true, project_id: true },
    });

    if (!item || !(await canViewProject(req.user.id, item.project_id))) {
      return res.status(404).json({ error: 'Item not found or access denied' });
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          text,
          user_id: req.user.id,
          item_id: item.id,
        },
        include: commentInclude,
      });

      await followItem(tx, item, req.user.id);

      await recordCommentHistory(tx, {
        itemId: item.id,
        projectId: item.project_id,
        userId: req.user.id,
        commentId: created.id,
        eventType: ItemHistoryEvent.COMMENT_CREATED,
        newText: created.text,
      });

      return created;
    });

    await publishDomainEvent({ eventType: 'COMMENT_CREATED', actor: { id: req.user.id }, project: { id: item.project_id }, entity: { type: 'COMMENT', id: comment.id }, payload: { itemId: item.id } });

    res.status(201).json(commentResponse(comment));
  }

  async update(req: any, res: Response) {
    const text = parseText(req.body.text);
    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const comment = await prisma.comment.findFirst({
      where: { id: req.params.commentId, deletedAt: null },
      select: {
        id: true,
        user_id: true,
        text: true,
        item_id: true,
        item: { select: { project_id: true } },
      },
    });

    if (!comment || !(await canViewProject(req.user.id, comment.item.project_id))) {
      return res.status(404).json({ error: 'Comment not found or access denied' });
    }

    const canManage = comment.user_id === req.user.id
      || await isProjectOwnerOrAdmin(req.user.id, comment.item.project_id);
    if (!canManage) {
      return res.status(403).json({ error: 'You do not have permission to update this comment' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const edited = await tx.comment.update({
        where: { id: comment.id },
        data: { text, editedAt: new Date() },
        include: commentInclude,
      });

      await recordCommentHistory(tx, {
        itemId: comment.item_id,
        projectId: comment.item.project_id,
        userId: req.user.id,
        commentId: comment.id,
        eventType: ItemHistoryEvent.COMMENT_EDITED,
        oldText: comment.text,
        newText: edited.text,
      });

      return edited;
    });

    res.json(commentResponse(updated));
  }

  async delete(req: any, res: Response) {
    const comment = await prisma.comment.findFirst({
      where: { id: req.params.commentId, deletedAt: null },
      select: {
        id: true,
        user_id: true,
        text: true,
        item_id: true,
        item: { select: { project_id: true } },
      },
    });

    if (!comment || !(await canViewProject(req.user.id, comment.item.project_id))) {
      return res.status(404).json({ error: 'Comment not found or access denied' });
    }

    const canManage = comment.user_id === req.user.id
      || await isProjectOwnerOrAdmin(req.user.id, comment.item.project_id);
    if (!canManage) {
      return res.status(403).json({ error: 'You do not have permission to delete this comment' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: comment.id },
        data: { deletedAt: new Date() },
      });

      await recordCommentHistory(tx, {
        itemId: comment.item_id,
        projectId: comment.item.project_id,
        userId: req.user.id,
        commentId: comment.id,
        eventType: ItemHistoryEvent.COMMENT_DELETED,
        oldText: comment.text,
      });
    });

    res.status(204).send();
  }
}
