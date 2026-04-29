import { describe, expect, it } from 'vitest';
import { formatInTimeZone } from '../src/excel/format-time.js';

// 2026-04-22 21:30 UTC = 2026-04-22 5:30 PM in Eastern Daylight Time.
// (Indianapolis follows DST.)
const SAMPLE = new Date('2026-04-22T21:30:00.000Z');

describe('formatInTimeZone (closes legacy L5: military-time-PM bug)', () => {
  it('renders unambiguous 12-hour time in the supplied IANA tz', () => {
    const out = formatInTimeZone(SAMPLE, 'America/Indiana/Indianapolis');
    expect(out).toMatch(/^04\/22\/2026, /);
    // Crucially: 12-hour clock with AM/PM, never both 24-hour AND PM.
    expect(out).toMatch(/\b5:30\s?PM\b/);
    expect(out).not.toMatch(/\b17:30\b/);
  });

  it('respects different timezones', () => {
    const tokyo = formatInTimeZone(SAMPLE, 'Asia/Tokyo');
    const la = formatInTimeZone(SAMPLE, 'America/Los_Angeles');
    expect(tokyo).not.toBe(la);
    // Tokyo is +9, so 21:30 UTC → 06:30 next morning Tokyo time.
    expect(tokyo).toMatch(/04\/23\/2026/);
    expect(tokyo).toMatch(/6:30\s?AM/);
    // LA is -7 in DST → 14:30 same day.
    expect(la).toMatch(/04\/22\/2026/);
    expect(la).toMatch(/2:30\s?PM/);
  });

  it('falls back to ISO when the timezone is invalid (legacy garbage tolerance)', () => {
    const out = formatInTimeZone(SAMPLE, 'Not/A/Real/Tz');
    expect(out).toBe(SAMPLE.toISOString());
  });

  it('renders a time at the noon/midnight boundary correctly (12:xx not 0:xx)', () => {
    const noon = new Date('2026-04-22T16:00:00.000Z'); // = noon Eastern
    const out = formatInTimeZone(noon, 'America/Indiana/Indianapolis');
    expect(out).toMatch(/12:00\s?PM/);
  });
});
