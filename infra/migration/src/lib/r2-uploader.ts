import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import pLimit from 'p-limit';

let client: S3Client | null = null;

export function getS3(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: must('S3_ENDPOINT'),
    credentials: {
      accessKeyId: must('S3_ACCESS_KEY'),
      secretAccessKey: must('S3_SECRET_KEY'),
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  });
  return client;
}

const concurrency = Math.max(1, Number(process.env.PHOTO_UPLOAD_CONCURRENCY ?? '16'));
export const uploadLimit = pLimit(concurrency);

export async function uploadIfMissing(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ uploaded: boolean }> {
  const bucket = must('S3_BUCKET');
  const s3 = getS3();
  // Quick existence check — we dedupe by SHA-256 in the key, so a hit
  // means we already shipped this exact byte sequence.
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { uploaded: false };
  } catch {
    /* not found — fall through to upload */
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      // No public-read ACL — the API mints signed URLs on demand.
    }),
  );
  return { uploaded: true };
}

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
