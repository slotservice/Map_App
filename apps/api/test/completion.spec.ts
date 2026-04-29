import { describe, expect, it } from 'vitest';
import { completeStoreRequestSchema } from '@map-app/shared';

describe('completeStoreRequestSchema', () => {
  const ok = {
    firstName: 'Asdf',
    lastName: 'User',
    signaturePhotoId: '00000000-0000-0000-0000-000000000001',
    generalComments: 'no issues',
    counts: { Handicap: 3 },
    deviceTimezone: 'America/Indiana/Indianapolis',
    completedAt: '2026-04-29T20:00:00.000Z',
    beforePhotoIds: [],
    afterPhotoIds: [],
  };

  it('accepts a valid payload', () => {
    expect(() => completeStoreRequestSchema.parse(ok)).not.toThrow();
  });

  it('rejects missing first/last name', () => {
    expect(() =>
      completeStoreRequestSchema.parse({ ...ok, firstName: '' }),
    ).toThrow();
    expect(() =>
      completeStoreRequestSchema.parse({ ...ok, lastName: '' }),
    ).toThrow();
  });

  it('rejects non-uuid signature id', () => {
    expect(() =>
      completeStoreRequestSchema.parse({ ...ok, signaturePhotoId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects negative counts', () => {
    expect(() =>
      completeStoreRequestSchema.parse({ ...ok, counts: { Handicap: -1 } }),
    ).toThrow();
  });

  it('caps photo arrays at 50', () => {
    expect(() =>
      completeStoreRequestSchema.parse({
        ...ok,
        beforePhotoIds: Array.from({ length: 51 }, () => '00000000-0000-0000-0000-000000000001'),
      }),
    ).toThrow();
  });
});
