import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

/**
 * Register the device for push notifications and tell the API our
 * Expo push token. Idempotent — safe to call on every app launch.
 *
 * Returns the token (or null if denied / unsupported / running in a
 * simulator without a project id).
 */
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push doesn't work on simulators. Don't blow up; just no-op.
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  // Android requires a default channel before tokens fire.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) {
    // Dev build without EAS project linked — token won't work, skip.
    return null;
  }

  const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
  const pushToken = tokenRes.data;

  try {
    await api.post('devices', {
      json: {
        pushToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      },
    });
  } catch {
    // Non-fatal; we'll retry on the next launch.
    return pushToken;
  }
  return pushToken;
}

export async function deregisterPush(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await api.delete(`devices/${encodeURIComponent(token)}`);
  } catch {
    /* swallow — server might be unreachable on logout */
  }
}
