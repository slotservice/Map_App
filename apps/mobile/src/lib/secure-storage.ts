import * as SecureStore from 'expo-secure-store';

const ACCESS = 'mapapp.accessToken';
const REFRESH = 'mapapp.refreshToken';
const USER = 'mapapp.user';

export const getAccessToken = () => SecureStore.getItemAsync(ACCESS);
export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH);
export const getUserBlob = () => SecureStore.getItemAsync(USER);

export async function persistSession(
  accessToken: string,
  refreshToken: string,
  userJson: string,
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS, accessToken),
    SecureStore.setItemAsync(REFRESH, refreshToken),
    SecureStore.setItemAsync(USER, userJson),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS),
    SecureStore.deleteItemAsync(REFRESH),
    SecureStore.deleteItemAsync(USER),
  ]);
}
