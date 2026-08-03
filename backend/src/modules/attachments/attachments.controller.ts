import { createHash } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { prisma } from '../../infrastructure/db';
import type { AuthRequest } from '../../middlewares/authMiddleware';
import { canUpdateItem, canViewProject, isProjectOwnerOrAdmin } from '../../services/permissions';
import {
  attachmentResponse,
  createAttachmentDownload,
  findAttachment,
  listAttachments,
  softDeleteAttachment,
  storeAttachment,
} from '../../services/attachments';
import { validateFileContent } from './attachments.upload';
import { publishDomainEvent } from '../../infrastructure/domainEvents';

type AuthorizedItemRequest = AuthRequest & {
  itemContext?: { id: string; project_id: string };
};

function statusError(message: string, status: number) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function routeParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== 'string' || !value) throw statusError(`${name} is required`, 400);
  return value;
}

export async function authorizeAttachmentUpload(req: AuthorizedItemRequest, res: Response, next: NextFunction) {
  try {
    const item = await prisma.item.findUnique({
      where: { id: routeParam(req.params.itemId, 'itemId') },
      select: { id: true, project_id: true },
    });
    if (!item || !req.user || !(await canViewProject(req.user.id, item.project_id))) {
      return res.status(404).json({ error: 'Item not found or access denied' });
    }
    if (!(await canUpdateItem(req.user.id, item.project_id))) {
      return res.status(403).json({ error: 'You do not have permission to attach files to this item' });
    }
    req.itemContext = item;
    next();
  } catch (error) {
    next(error);
  }
}

export class AttachmentsController {
  async list(req: AuthorizedItemRequest, res: Response) {
    const item = await prisma.item.findUnique({
      where: { id: routeParam(req.params.itemId, 'itemId') },
      select: { id: true, project_id: true },
    });
    if (!item || !req.user || !(await canViewProject(req.user.id, item.project_id))) {
      return res.status(404).json({ error: 'Item not found or access denied' });
    }
    const attachments = await listAttachments(item.id);
    const canUpload = await canUpdateItem(req.user.id, item.project_id);
    const canManageAttachments = await isProjectOwnerOrAdmin(req.user.id, item.project_id);
    res.json({
      data: attachments.map((attachment) => ({
        ...attachmentResponse(attachment),
        canDelete: attachment.user_id === req.user?.id || canManageAttachments,
      })),
      permissions: { canUpload },
    });
  }

  async create(req: AuthorizedItemRequest, res: Response) {
    if (!req.file) throw statusError('A file is required in the file field', 400);
    if (!validateFileContent(req.file)) throw statusError('File content does not match its declared MIME type', 415);
    if (!req.user || !req.itemContext) throw statusError('Item access was not validated', 403);

    const attachment = await storeAttachment({
      itemId: req.itemContext.id,
      projectId: req.itemContext.project_id,
      userId: req.user.id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype.toLowerCase(),
      sizeBytes: req.file.size,
      checksum: `sha256:${createHash('sha256').update(req.file.buffer).digest('hex')}`,
      content: req.file.buffer,
    });
    await publishDomainEvent({ eventType: 'ATTACHMENT_CREATED', actor: { id: req.user.id }, project: { id: req.itemContext.project_id }, entity: { type: 'ATTACHMENT', id: (attachment as { id: string }).id }, payload: { itemId: req.itemContext.id, mimeType: req.file.mimetype.toLowerCase(), sizeBytes: req.file.size } });
    res.status(201).json(attachmentResponse(attachment as Parameters<typeof attachmentResponse>[0]));
  }

  async download(req: AuthorizedItemRequest, res: Response) {
    const attachment = await findAttachment(routeParam(req.params.attachmentId, 'attachmentId'));
    if (!attachment || !req.user || !(await canViewProject(req.user.id, attachment.item.project_id))) {
      return res.status(404).json({ error: 'Attachment not found or access denied' });
    }
    const url = await createAttachmentDownload(attachment, req.user.id);
    res.json({ url, expiresInSeconds: Number(process.env.MINIO_SIGNED_URL_EXPIRY_SECONDS || 900) });
  }

  async delete(req: AuthorizedItemRequest, res: Response) {
    const attachment = await findAttachment(routeParam(req.params.attachmentId, 'attachmentId'));
    if (!attachment || !req.user || !(await canViewProject(req.user.id, attachment.item.project_id))) {
      return res.status(404).json({ error: 'Attachment not found or access denied' });
    }
    const canDelete = attachment.user_id === req.user.id
      || await isProjectOwnerOrAdmin(req.user.id, attachment.item.project_id);
    if (!canDelete) {
      return res.status(403).json({ error: 'You do not have permission to delete this attachment' });
    }
    await softDeleteAttachment(attachment, req.user.id);
    res.status(204).send();
  }
}
