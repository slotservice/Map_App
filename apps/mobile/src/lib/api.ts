import ky from 'ky';
import Constants from 'expo-constants';
import { getAccessToken } from './secure-storage';

const apiUrl = (Constants.expoConfig?.extra?.apiUrl as string) || 'http://localhost:3001';

export const api = ky.create({
  prefixUrl: `${apiUrl}/api/v1`,
  retry: { limit: 1 },
  timeout: 15_000,
  hooks: {
    beforeRequest: [
      async (req) => {
        const token = await getAccessToken();
        if (token) req.headers.set('Authorization', `Bearer ${token}`);
      },
    ],
  },
});
