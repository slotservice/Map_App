import { PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Bridge between class-validator (NestJS default) and Zod schemas
 * defined in `@map-app/shared`. Apply per-handler when the body shape
 * comes from a shared DTO:
 *
 *   @Post('login')
 *   login(@Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest)
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
