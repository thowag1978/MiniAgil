import { apiRequest } from './client';
import type { AuthUser } from '@/lib/types';

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authApi = {
  login(input: LoginInput) {
    return apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(input),
    });
  },
  me(token?: string | null) {
    return apiRequest<AuthUser | null>('/api/auth/me', { token });
  },
  register(input: { name: string; email: string; password: string }) {
    return apiRequest<{ id: string; email: string; name: string }>('/api/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(input),
    });
  },
  forgotPassword(email: string) {
    return apiRequest<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(input: { email: string; token: string; newPassword: string }) {
    return apiRequest<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(input),
    });
  },
};

