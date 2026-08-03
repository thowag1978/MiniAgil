import { apiRequest } from './client';
import type { BugEnvironment, BugRetest, BugRetestResult } from '@/lib/types';

export const bugRetestsApi = {
  list(itemId: string) {
    return apiRequest<BugRetest[]>(`/api/items/${itemId}/retests`);
  },
  create(itemId: string, input: { environment: BugEnvironment; result: BugRetestResult; observations?: string; target_status_id?: string }) {
    return apiRequest<BugRetest>(`/api/items/${itemId}/retests`, { method: 'POST', body: JSON.stringify(input) });
  },
};
