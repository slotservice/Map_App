import { create } from 'zustand';
import type { AuthUser, LoginResponse } from '@map-app/shared';
import { api } from './api';
import { clearSession, getAccessToken, getUserBlob, persistSession } from './secure-storage';
import { deregisterPush, registerForPush } from './push';

interface AuthState {
  user: AuthUser | null;
  hasToken: boolean;
  pushToken: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hasToken: false,
  pushToken: null,

  hydrate: async () => {
    const [token, userBlob] = await Promise.all([getAccessToken(), getUserBlob()]);
    if (token && userBlob) {
      set({ hasToken: true, user: JSON.parse(userBlob) as AuthUser });
      // Re-register push on every launch in case the project id or
      // token changed.
      registerForPush()
        .then((pt) => set({ pushToken: pt }))
        .catch(() => {});
    }
  },

  login: async (email, password) => {
    const res = (await api.post('auth/login', { json: { email, password } }).json()) as LoginResponse;
    await persistSession(res.tokens.accessToken, res.tokens.refreshToken, JSON.stringify(res.user));
    set({ user: res.user, hasToken: true });
    // Fire-and-forget push registration — failures here shouldn't
    // block login (e.g. user denied permission).
    registerForPush()
      .then((pt) => set({ pushToken: pt }))
      .catch(() => {});
  },

  logout: async () => {
    const { pushToken } = get();
    await deregisterPush(pushToken);
    try {
      await api.post('auth/logout');
    } catch {
      /* swallow */
    }
    await clearSession();
    set({ user: null, hasToken: false, pushToken: null });
  },
}));
