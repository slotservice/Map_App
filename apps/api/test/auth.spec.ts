import { describe, expect, it } from 'vitest';
import { loginRequestSchema } from '@map-app/shared';

describe('loginRequestSchema (smoke)', () => {
  it('accepts a valid email + password', () => {
    expect(() =>
      loginRequestSchema.parse({ email: 'admin@example.com', password: 'hunter2' }),
    ).not.toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => loginRequestSchema.parse({ email: 'not-an-email', password: 'x' })).toThrow();
  });

  it('rejects empty password', () => {
    expect(() => loginRequestSchema.parse({ email: 'admin@example.com', password: '' })).toThrow();
  });
});
