/**
 * Domain error codes. The HTTP status is decided by the API; this enum
 * lets clients render specific UX (e.g. "old password didn't match"
 * vs a generic 401).
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  OLD_PASSWORD_MISMATCH: 'OLD_PASSWORD_MISMATCH',
  ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED',
  EXCEL_PARSE_FAILED: 'EXCEL_PARSE_FAILED',
  PHOTO_UPLOAD_FAILED: 'PHOTO_UPLOAD_FAILED',
  COMPLETION_ALREADY_EXISTS: 'COMPLETION_ALREADY_EXISTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** RFC-7807-style problem detail used by every API error response. */
export interface ApiError {
  type: ErrorCode;
  title: string;
  status: number;
  detail?: string;
  /** Field-level validation errors keyed by dot-path. */
  errors?: Record<string, string[]>;
  /** Per-request trace id for correlating with server logs. */
  traceId?: string;
}
