import { z } from 'zod';

export const devicePlatformSchema = z.enum(['ios', 'android']);
export type DevicePlatform = z.infer<typeof devicePlatformSchema>;

export const registerDeviceRequestSchema = z.object({
  /**
   * The expo-notifications push token. Format: `ExponentPushToken[xxx]`
   * (Expo) or `ExpoPushToken[xxx]`. We don't enforce the exact prefix
   * because Expo has changed it in the past — just require non-empty.
   */
  pushToken: z.string().min(10).max(200),
  platform: devicePlatformSchema,
  label: z.string().max(100).optional(),
});
export type RegisterDeviceRequest = z.infer<typeof registerDeviceRequestSchema>;
