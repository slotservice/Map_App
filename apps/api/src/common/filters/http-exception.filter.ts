import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { ErrorCode, type ApiError } from '@map-app/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const traceId = (req.headers['x-request-id'] as string | undefined) ?? '';

    if (exception instanceof ZodError) {
      const body: ApiError = {
        type: ErrorCode.VALIDATION_FAILED,
        title: 'Validation failed',
        status: HttpStatus.BAD_REQUEST,
        errors: zodErrorsByPath(exception),
        traceId,
      };
      res.status(body.status).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const rawMessage =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ?? exception.message);
      const messageStr = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage;

      // When the exception's message is itself a known ErrorCode (services
      // throw `new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS)`),
      // promote it to `type` so the client can switch on it. Otherwise
      // fall back to the broad status-class code with the raw message
      // as the title.
      const isKnownCode = (Object.values(ErrorCode) as string[]).includes(messageStr);
      const body: ApiError = isKnownCode
        ? {
            type: messageStr as ErrorCode,
            title: titleForCode(messageStr as ErrorCode),
            status,
            traceId,
          }
        : {
            type: mapStatusToErrorCode(status),
            title: messageStr,
            status,
            traceId,
          };
      res.status(status).json(body);
      return;
    }

    this.logger.error(exception);
    const body: ApiError = {
      type: ErrorCode.INTERNAL_ERROR,
      title: 'Internal server error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      traceId,
    };
    res.status(body.status).json(body);
  }
}

function mapStatusToErrorCode(status: number): ErrorCode {
  if (status === 400) return ErrorCode.VALIDATION_FAILED;
  if (status === 401) return ErrorCode.UNAUTHORIZED;
  if (status === 403) return ErrorCode.FORBIDDEN;
  if (status === 404) return ErrorCode.NOT_FOUND;
  if (status === 409) return ErrorCode.CONFLICT;
  return ErrorCode.INTERNAL_ERROR;
}

function titleForCode(code: ErrorCode): string {
  switch (code) {
    case ErrorCode.INVALID_CREDENTIALS: return 'Invalid credentials';
    case ErrorCode.OLD_PASSWORD_MISMATCH: return 'Old password does not match';
    case ErrorCode.ACCOUNT_BLOCKED: return 'Account is blocked';
    case ErrorCode.VALIDATION_FAILED: return 'Validation failed';
    case ErrorCode.UNAUTHORIZED: return 'Unauthorized';
    case ErrorCode.FORBIDDEN: return 'Forbidden';
    case ErrorCode.NOT_FOUND: return 'Not found';
    case ErrorCode.CONFLICT: return 'Conflict';
    case ErrorCode.EXCEL_PARSE_FAILED: return 'Could not parse the Excel file';
    case ErrorCode.PHOTO_UPLOAD_FAILED: return 'Photo upload failed';
    case ErrorCode.COMPLETION_ALREADY_EXISTS: return 'This store is already complete';
    case ErrorCode.INTERNAL_ERROR: return 'Internal server error';
  }
}

function zodErrorsByPath(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.errors) {
    const path = issue.path.join('.') || '_root';
    out[path] = out[path] ?? [];
    out[path].push(issue.message);
  }
  return out;
}
