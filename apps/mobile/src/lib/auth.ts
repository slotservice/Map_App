import { create } from 'zustand';
import type { AuthUser, LoginResponse } from '@map-app/shared';
import { api } from './api';
import { clearSession, getAccessToken, getUserBlob, persistSession } from './secure-storage';

interface AuthState {
  user: AuthUser | null;
  hasToken: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hasToken: false,

  hydrate: async () => {
    const [token, userBlob] = await Promise.all([getAccessToken(), getUserBlob()]);
    if (token && userBlob) {
      set({ hasToken: true, user: JSON.parse(userBlob) as AuthUser });
    }
  },

  login: async (email, password) => {
    const res = (await api.post('auth/login', { json: { email, password } }).json()) as LoginResponse;
    await persistSession(res.tokens.accessToken, res.tokens.refreshToken, JSON.stringify(res.user));
    set({ user: res.user, hasToken: true });
  },

  logout: async () => {
    try {
      await api.post('auth/logout');
    } catch {
      /* swallow */
    }
    await clearSession();
    set({ user: null, hasToken: false });
  },
}));
