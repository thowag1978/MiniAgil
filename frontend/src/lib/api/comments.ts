import { apiRequest } from './client';
import type { ItemComment } from '@/lib/types';

export const commentsApi = {
  list(itemId: string) {
    return apiRequest<ItemComment[]>(`/api/items/${itemId}/comments`);
  },
  create(itemId: string, text: string) {
    return apiRequest<ItemComment>(`/api/items/${itemId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },
  update(commentId: string, text: string) {
    return apiRequest<ItemComment>(`/api/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ text }),
    });
  },
  remove(commentId: string) {
    return apiRequest<void>(`/api/comments/${commentId}`, { method: 'DELETE' });
  },
};
