/**
 * User roles. Numeric values match the legacy `users.type` column for
 * migration; mappings:
 *   1 → admin   (legacy USER_ADMIN)
 *   2 → vendor  (legacy USER_VENDOR)
 *   3 → viewer  (new — was unused in legacy)
 *   4 → worker  (legacy USER_WORKER)
 */
export const UserRole = {
  ADMIN: 'admin',
  VENDOR: 'vendor',
  VIEWER: 'viewer',
  WORKER: 'worker',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const LEGACY_USER_TYPE_TO_ROLE: Record<number, UserRole> = {
  1: UserRole.ADMIN,
  2: UserRole.VENDOR,
  3: UserRole.VIEWER,
  4: UserRole.WORKER,
};

/** Per-task initial / current status. */
export const TaskStatus = {
  NEEDS_SCHEDULED: 'needs_scheduled',
  SCHEDULED_OR_COMPLETE: 'scheduled_or_complete',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/** Map-marker colour states. See REBUILD_PLAN.md Appendix E. */
export const MarkerColor = {
  /** All tasks needs-scheduled, not yet visited. */
  BLUE: 'blue',
  /** Mix of tasks: some needs-scheduled, some pre-existing complete. */
  ORANGE: 'orange',
  /** Worker has completed at least one task on this visit but not all. */
  YELLOW: 'yellow',
  /** All tasks complete + completion record exists. */
  RED: 'red',
} as const;

export type MarkerColor = (typeof MarkerColor)[keyof typeof MarkerColor];

/** Photo "kind" — disambiguates photos in the same store. */
export const PhotoKind = {
  BEFORE: 'before',
  AFTER: 'after',
  TAG_ALERT: 'tag_alert',
  PROPERTY_VIEW: 'property_view',
  SIGNATURE: 'signature',
} as const;

export type PhotoKind = (typeof PhotoKind)[keyof typeof PhotoKind];

/** User account status. */
export const UserStatus = {
  ACTIVE: 'active',
  BLOCKED: 'blocked',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
