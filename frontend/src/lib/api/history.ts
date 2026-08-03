import { apiRequest } from './client';
import type { ItemHistoryPage } from '@/lib/types';

export const historyApi = {
  list(itemId: string, page = 1, limit = 20) {
    return apiRequest<ItemHistoryPage>(`/api/items/${itemId}/history?page=${page}&limit=${limit}`);
  },
};
