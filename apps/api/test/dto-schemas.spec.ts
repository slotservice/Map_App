import { describe, expect, it } from 'vitest';
import {
  changePasswordRequestSchema,
  createTagAlertRequestSchema,
  createUserRequestSchema,
  finalizePhotoRequestSchema,
  forgotPasswordRequestSchema,
  mapAssignmentSchema,
  passwordResetConfirmRequestSchema,
  presignUploadRequestSchema,
  updateMapRequestSchema,
  UserRole,
} from '@map-app/shared';

describe('DTO schemas (negative cases that would otherwise leak through)', () => {
  it('changePassword: rejects empty old password', () => {
    expect(() =>
      changePasswordRequestSchema.parse({ oldPassword: '', newPassword: 'longenough' }),
    ).toThrow();
  });

  it('changePassword: rejects too-short new password', () => {
    expect(() =>
      changePasswordRequestSchema.parse({ oldPassword: 'whatever', newPassword: 'short' }),
    ).toThrow();
  });

  it('forgotPassword: requires a real email', () => {
    expect(() => forgotPasswordRequestSchema.parse({ email: 'not-an-email' })).toThrow();
    expect(() => forgotPasswordRequestSchema.parse({ email: 'real@example.com' })).not.toThrow();
  });

  it('passwordResetConfirm: rejects too-short new password + missing token', () => {
    expect(() =>
      passwordResetConfirmRequestSchema.parse({ token: '', newPassword: 'longenough' }),
    ).toThrow();
    expect(() =>
      passwordResetConfirmRequestSchema.parse({ token: 'tok', newPassword: 'short' }),
    ).toThrow();
  });

  it('createUser: requires a valid role', () => {
    expect(() =>
      createUserRequestSchema.parse({
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        role: 'sysadmin',
      }),
    ).toThrow();
    expect(() =>
      createUserRequestSchema.parse({
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        role: UserRole.WORKER,
      }),
    ).not.toThrow();
  });

  it('createTagAlert: caps photoIds at 8', () => {
    const ok = (n: number) =>
      createTagAlertRequestSchema.parse({
        title: 'x',
        description: 'y',
        photoIds: Array.from({ length: n }, () => '00000000-0000-0000-0000-000000000001'),
      });
    expect(() => ok(8)).not.toThrow();
    expect(() => ok(9)).toThrow();
  });

  it('finalizePhoto: requires SHA-256 hex', () => {
    expect(() => finalizePhotoRequestSchema.parse({ sha256: 'too-short' })).toThrow();
    expect(() =>
      finalizePhotoRequestSchema.parse({
        sha256: 'a'.repeat(64),
      }),
    ).not.toThrow();
  });

  it('presignUpload: rejects unsupported content types', () => {
    expect(() =>
      presignUploadRequestSchema.parse({
        kind: 'before',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toThrow();
    expect(() =>
      presignUploadRequestSchema.parse({
        kind: 'before',
        contentType: 'image/png',
        sizeBytes: 1024,
      }),
    ).not.toThrow();
  });

  it('presignUpload: rejects oversize photos', () => {
    expect(() =>
      presignUploadRequestSchema.parse({
        kind: 'before',
        contentType: 'image/jpeg',
        sizeBytes: 25 * 1024 * 1024, // 25 MB
      }),
    ).toThrow();
  });

  it('updateMap: caps tag-alert recipients at 50', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => `r${i}@example.com`);
    expect(() =>
      updateMapRequestSchema.parse({ tagAlertRecipients: fifty }),
    ).not.toThrow();
    expect(() =>
      updateMapRequestSchema.parse({
        tagAlertRecipients: [...fifty, 'one-too-many@example.com'],
      }),
    ).toThrow();
  });

  it('mapAssignment: rejects admin role (admin assigns; admins are not assigned)', () => {
    expect(() =>
      mapAssignmentSchema.parse({
        userId: '00000000-0000-0000-0000-000000000001',
        role: UserRole.ADMIN,
      }),
    ).toThrow();
    expect(() =>
      mapAssignmentSchema.parse({
        userId: '00000000-0000-0000-0000-000000000001',
        role: UserRole.WORKER,
      }),
    ).not.toThrow();
  });
});
