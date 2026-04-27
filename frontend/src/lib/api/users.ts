import { apiRequest } from './client';
import type { AuthUser, UserRole } from '@/lib/types';

export interface UserListItem extends AuthUser {
  createdAt: string;
}

export const usersApi = {
  list() {
    return apiRequest<UserListItem[]>('/api/users');
  },
  create(input: { name: string; email: string; password: string; role: UserRole }) {
    return apiRequest<UserListItem>('/api/users', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateRole(id: string, role: UserRole) {
    return apiRequest<AuthUser>(`/api/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },
  updatePassword(id: string, newPassword: string) {
    return apiRequest<{ success: boolean }>(`/api/users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
    });
  },
  remove(id: string) {
    return apiRequest<{ success: boolean }>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },
};

