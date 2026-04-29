/**
 * Render a UTC instant in an IANA timezone using the locale-aware
 * 12-hour clock — `MM/DD/YYYY h:mm AM/PM`.
 *
 * This is the function that fixes legacy bug L5: the legacy export hard-
 * coded `'m/d/Y H:i A'` which is 24-hour-with-AM/PM (e.g. `01/15/2026
 * 14:30 PM` — what the client called "military time"). We use Intl with
 * `hour12: true` so the result is unambiguously 12-hour.
 *
 * If the timezone string is invalid (legacy data may have garbage),
 * fall back to the ISO instant — visible enough for the admin to
 * notice but doesn't crash the export.
 */
export function formatInTimeZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
