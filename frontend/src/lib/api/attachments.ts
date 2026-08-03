import { apiRequest } from './client';
import type { ItemAttachment, ItemAttachmentList } from '@/lib/types';

export const attachmentsApi = {
  list(itemId: string) {
    return apiRequest<ItemAttachmentList>(`/api/items/${itemId}/attachments`);
  },
  upload(itemId: string, file: File) {
    const body = new FormData();
    body.append('file', file);
    return apiRequest<ItemAttachment>(`/api/items/${itemId}/attachments`, {
      method: 'POST',
      body,
    });
  },
  downloadUrl(attachmentId: string) {
    return apiRequest<{ url: string; expiresInSeconds: number }>(`/api/attachments/${attachmentId}/download`);
  },
  remove(attachmentId: string) {
    return apiRequest<void>(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
  },
};
