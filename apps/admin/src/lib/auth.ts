'use client';

import { create } from 'zustand';
import type { AuthUser, LoginResponse, TokenPair } from '@map-app/shared';
import { api } from './api';

interface AuthState {
  user: AuthUser | null;
  tokens: TokenPair | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const ACCESS_KEY = 'mapapp.accessToken';
const REFRESH_KEY = 'mapapp.refreshToken';
const USER_KEY = 'mapapp.user';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const access = window.localStorage.getItem(ACCESS_KEY);
    const refresh = window.localStorage.getItem(REFRESH_KEY);
    const user = window.localStorage.getItem(USER_KEY);
    if (access && refresh && user) {
      set({
        tokens: { accessToken: access, refreshToken: refresh, expiresIn: 0 },
        user: JSON.parse(user) as AuthUser,
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

  login: async (email, password) => {
    const res = (await api.post('auth/login', { json: { email, password } }).json()) as LoginResponse;
    window.localStorage.setItem(ACCESS_KEY, res.tokens.accessToken);
    window.localStorage.setItem(REFRESH_KEY, res.tokens.refreshToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    set({ user: res.user, tokens: res.tokens });
  },

  logout: async () => {
    try {
      await api.post('auth/logout');
    } catch {
      /* swallow */
    }
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(USER_KEY);
    set({ user: null, tokens: null });
  },
}));
