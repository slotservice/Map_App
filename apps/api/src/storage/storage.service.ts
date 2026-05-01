import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Thin wrapper around the S3-compatible bucket (MinIO locally,
 * Cloudflare R2 in prod). Two operations: presign-upload + presign-read.
 * Photo uploads always flow client → S3 directly; the server only mints
 * presigned URLs and validates the resulting metadata on finalize.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.publicBase = config.getOrThrow<string>('S3_PUBLIC_URL');
    this.client = new S3Client({
      region: config.getOrThrow<string>('S3_REGION'),
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
      forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE') ?? false,
      // AWS SDK ≥ 3.726 defaults to WHEN_SUPPORTED, which makes presign
      // bake an `x-amz-checksum-crc32` header into the signature; clients
      // that don't compute the checksum then get SignatureDoesNotMatch
      // from MinIO + Cloudflare R2. Restrict to WHEN_REQUIRED so PutObject
      // (no required checksum) goes through cleanly.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /** HEAD an object — returns size + ETag if present, null if missing. */
  async headObject(key: string): Promise<{ sizeBytes: number; etag: string | null } | null> {
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        sizeBytes: out.ContentLength ?? 0,
        etag: out.ETag?.replace(/"/g, '') ?? null,
      };
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === 'NotFound' || name === 'NoSuchKey') return null;
      this.logger.error(`HEAD ${key} failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async presignUpload(
    key: string,
    contentType: string,
    contentLength: number,
    expiresInSeconds = 900,
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    const url = await getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
    return {
      url,
      headers: {
        'Content-Type': contentType,
      },
    };
  }

  async presignRead(key: string, expiresInSeconds = 900): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  publicUrl(key: string): string {
    return `${this.publicBase.replace(/\/$/, '')}/${key}`;
  }
}
