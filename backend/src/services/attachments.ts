import { ItemHistoryEvent, type Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import type { Readable } from 'node:stream';
import { prisma } from '../infrastructure/db';
import { createObjectStorageService, type ObjectStorageService } from '../infrastructure/storage';
import { recordAttachmentHistory } from './itemHistory';

type CreateAttachmentInput = {
  itemId: string;
  projectId: string;
  userId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  content: Buffer | Readable;
};

type PersistAttachment = (input: {
  itemId: string;
  projectId: string;
  userId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  bucket: string;
  objectKey: string;
}) => Promise<unknown>;

export function safeOriginalName(value: string) {
  return basename(value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255) || 'file';
}

function createObjectKey(itemId: string, originalName: string) {
  const extension = extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `items/${itemId}/${randomUUID()}${extension}`;
}

async function persistAttachment(input: Parameters<PersistAttachment>[0]) {
  return prisma.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        item_id: input.itemId,
        user_id: input.userId,
        bucket: input.bucket,
        object_key: input.objectKey,
        original_name: input.originalName,
        mime_type: input.mimeType,
        size_bytes: BigInt(input.sizeBytes),
        checksum: input.checksum ?? null,
        fileName: input.originalName,
        s3_url: null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await recordAttachmentHistory(tx, {
      itemId: input.itemId,
      projectId: input.projectId,
      userId: input.userId,
      attachmentId: attachment.id,
      eventType: ItemHistoryEvent.ATTACHMENT_UPLOADED,
      fileName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });
    return attachment;
  });
}

export async function storeAttachment(
  input: CreateAttachmentInput,
  dependencies?: { storage?: ObjectStorageService; persist?: PersistAttachment },
) {
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0) {
    throw new Error('Attachment size must be a non-negative safe integer');
  }

  const storage = dependencies?.storage ?? createObjectStorageService();
  const persist = dependencies?.persist ?? persistAttachment;
  const originalName = safeOriginalName(input.originalName);
  const objectKey = createObjectKey(input.itemId, originalName);
  const storedObject = await storage.upload(objectKey, input.content, input.sizeBytes, input.mimeType);

  try {
    return await persist({ ...input, originalName, ...storedObject });
  } catch (error) {
    try {
      await storage.remove(storedObject.objectKey);
    } catch (cleanupError) {
      console.error('Failed to remove object after attachment persistence error', cleanupError);
    }
    throw error;
  }
}

const attachmentSelect = {
  id: true,
  item_id: true,
  user_id: true,
  original_name: true,
  fileName: true,
  mime_type: true,
  size_bytes: true,
  checksum: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AttachmentSelect;

export function attachmentResponse(attachment: {
  id: string;
  item_id: string;
  user_id: string | null;
  original_name: string | null;
  fileName: string | null;
  mime_type: string | null;
  size_bytes: bigint | null;
  checksum: string | null;
  createdAt: Date;
  user: { id: string; name: string; email: string } | null;
}) {
  return {
    id: attachment.id,
    item_id: attachment.item_id,
    user_id: attachment.user_id,
    fileName: attachment.original_name ?? attachment.fileName ?? 'Arquivo legado',
    mimeType: attachment.mime_type,
    sizeBytes: attachment.size_bytes === null ? null : Number(attachment.size_bytes),
    checksum: attachment.checksum,
    createdAt: attachment.createdAt,
    user: attachment.user,
  };
}

export async function listAttachments(itemId: string) {
  return prisma.attachment.findMany({
    where: { item_id: itemId, deletedAt: null },
    select: attachmentSelect,
    orderBy: { createdAt: 'asc' },
  });
}

export async function findAttachment(attachmentId: string) {
  return prisma.attachment.findFirst({
    where: { id: attachmentId, deletedAt: null },
    include: { item: { select: { project_id: true } } },
  });
}

export async function createAttachmentDownload(
  attachment: NonNullable<Awaited<ReturnType<typeof findAttachment>>>,
  userId: string,
  storage = createObjectStorageService(),
) {
  if (!attachment.bucket || !attachment.object_key) {
    const error = new Error('Legacy attachment is not available through secure storage') as Error & { status: number };
    error.status = 409;
    throw error;
  }
  const url = await storage.createSignedDownloadUrl(attachment.object_key, attachment.bucket);
  await prisma.$transaction((tx) => recordAttachmentHistory(tx, {
    itemId: attachment.item_id,
    projectId: attachment.item.project_id,
    userId,
    attachmentId: attachment.id,
    eventType: ItemHistoryEvent.ATTACHMENT_DOWNLOADED,
    fileName: attachment.original_name ?? attachment.fileName ?? 'Arquivo legado',
    mimeType: attachment.mime_type,
    sizeBytes: attachment.size_bytes === null ? null : Number(attachment.size_bytes),
  }));
  return url;
}

export async function softDeleteAttachment(
  attachment: NonNullable<Awaited<ReturnType<typeof findAttachment>>>,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.attachment.update({ where: { id: attachment.id }, data: { deletedAt: new Date() } });
    await recordAttachmentHistory(tx, {
      itemId: attachment.item_id,
      projectId: attachment.item.project_id,
      userId,
      attachmentId: attachment.id,
      eventType: ItemHistoryEvent.ATTACHMENT_DELETED,
      fileName: attachment.original_name ?? attachment.fileName ?? 'Arquivo legado',
      mimeType: attachment.mime_type,
      sizeBytes: attachment.size_bytes === null ? null : Number(attachment.size_bytes),
    });
  });
}
