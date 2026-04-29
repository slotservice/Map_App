import ky, { type KyInstance } from 'ky';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api: KyInstance = ky.create({
  prefixUrl: `${API_BASE}/api/v1`,
  retry: { limit: 1 },
  hooks: {
    beforeRequest: [
      (req) => {
        if (typeof window !== 'undefined') {
          const token = window.localStorage.getItem('mapapp.accessToken');
          if (token) req.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
  },
});
