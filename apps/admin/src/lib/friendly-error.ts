import { HTTPError } from 'ky';
import type { ApiError } from '@map-app/shared';

/**
 * Translate a raw API error / network error into a sentence the admin
 * actually wants to see. We:
 *   1. Try to parse the API's RFC-7807-style ApiError envelope so we
 *      can map known error codes to specific UX strings.
 *   2. Fall back to the HTTP status text.
 *   3. Fall back to the JS error message.
 */
export async function friendlyError(err: unknown): Promise<string> {
  if (err instanceof HTTPError) {
    let body: ApiError | null = null;
    try {
      body = (await err.response.clone().json()) as ApiError;
    } catch {
      /* not JSON */
    }

    if (body) {
      switch (body.type) {
        case 'INVALID_CREDENTIALS':
          return 'Wrong email or password.';
        case 'OLD_PASSWORD_MISMATCH':
          return "That doesn't match your current password.";
        case 'ACCOUNT_BLOCKED':
          return 'This account is blocked. Ask an admin to unblock it.';
        case 'VALIDATION_FAILED':
          if (body.errors) {
            // Surface field-level errors compactly.
            const lines = Object.entries(body.errors).map(
              ([k, v]) => `${k}: ${v.join('; ')}`,
            );
            return lines.join('\n');
          }
          return body.title || 'The form has an error.';
        case 'FORBIDDEN':
          return "You don't have permission to do that.";
        case 'NOT_FOUND':
          return body.title || 'Not found.';
        case 'CONFLICT':
          return body.title || 'That conflicts with the current state.';
        default:
          return body.title || 'Something went wrong on the server.';
      }
    }

    if (err.response.status === 0) return "Can't reach the server. Check your connection.";
    return err.response.statusText || `HTTP ${err.response.status}`;
  }

  if (err instanceof Error) return err.message;
  return 'Unknown error.';
}
