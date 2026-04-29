import ky, { HTTPError } from 'ky';
import Constants from 'expo-constants';
import type { TokenPair } from '@map-app/shared';
import {
  getAccessToken,
  getRefreshToken,
  persistSession,
  getUserBlob,
} from './secure-storage';

const apiUrl = (Constants.expoConfig?.extra?.apiUrl as string) || 'http://localhost:3001';

/**
 * Single-flight refresh: if the access token expired and 10 requests
 * fire concurrently, we want exactly one POST /auth/refresh, not 10.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const tokens = (await res.json()) as TokenPair;
      const userBlob = (await getUserBlob()) ?? '{}';
      await persistSession(tokens.accessToken, tokens.refreshToken, userBlob);
      return tokens.accessToken;
    } catch {
      return null;
    } finally {
      // Allow next refresh window after this completes.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

export const api = ky.create({
  prefixUrl: `${apiUrl}/api/v1`,
  retry: 0, // we handle retries via the 401 hook below
  timeout: 15_000,
  hooks: {
    beforeRequest: [
      async (req) => {
        const token = await getAccessToken();
        if (token) req.headers.set('Authorization', `Bearer ${token}`);
      },
    ],
    afterResponse: [
      async (req, _opts, response) => {
        if (response.status !== 401) return response;

        // Don't try to refresh on the auth endpoints themselves —
        // that would loop forever.
        const url = req.url;
        if (
          url.includes('/auth/login') ||
          url.includes('/auth/refresh') ||
          url.includes('/auth/logout')
        ) {
          return response;
        }

        const newToken = await refreshAccessToken();
        if (!newToken) return response;

        // Retry once with the fresh token.
        req.headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(req);
      },
    ],
  },
});

export { HTTPError };
