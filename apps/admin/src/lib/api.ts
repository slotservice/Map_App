import ky, { type KyInstance } from 'ky';
import type { TokenPair } from '@map-app/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const ACCESS_KEY = 'mapapp.accessToken';
const REFRESH_KEY = 'mapapp.refreshToken';
const USER_KEY = 'mapapp.user';

/** Single-flight refresh — coalesces concurrent 401-driven refreshes. */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = window.localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const tokens = (await res.json()) as TokenPair;
      window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
      window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
      return tokens.accessToken;
    } catch {
      return null;
    } finally {
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

export const api: KyInstance = ky.create({
  prefixUrl: `${API_BASE}/api/v1`,
  retry: 0,
  hooks: {
    beforeRequest: [
      (req) => {
        if (typeof window !== 'undefined') {
          const token = window.localStorage.getItem(ACCESS_KEY);
          if (token) req.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (req, _opts, response) => {
        if (response.status !== 401) return response;
        if (
          req.url.includes('/auth/login') ||
          req.url.includes('/auth/refresh') ||
          req.url.includes('/auth/logout')
        ) {
          return response;
        }
        const newToken = await refreshAccessToken();
        if (!newToken) {
          // Refresh failed — clear stale state and bounce to /login.
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(ACCESS_KEY);
            window.localStorage.removeItem(REFRESH_KEY);
            window.localStorage.removeItem(USER_KEY);
            if (!window.location.pathname.startsWith('/login')) {
              window.location.href = '/login';
            }
          }
          return response;
        }
        req.headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(req);
      },
    ],
  },
});
