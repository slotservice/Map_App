import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import type { PhotoKind, PresignUploadResponse } from '@map-app/shared';
import { api } from './api';

/**
 * End-to-end photo upload: presign → PUT to S3 (MinIO/R2 in prod) →
 * finalize with SHA-256. Returns the photoId once the server has marked
 * the row as finalized.
 *
 * `localUri` comes from expo-image-picker / expo-camera; it's a
 * file:// URI on device storage.
 */
export async function uploadPhoto(input: {
  storeId: string;
  localUri: string;
  kind: PhotoKind;
  fieldName?: string;
}): Promise<string> {
  // 1. Read the file's size + content type. expo-image-picker returns
  //    images as JPEG by default; we trust the URI extension here.
  const info = await FileSystem.getInfoAsync(input.localUri);
  if (!info.exists) throw new Error('Photo file is missing');

  const ext = (input.localUri.split('.').pop() ?? 'jpg').toLowerCase();
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  // 2. Presign.
  const presigned = (await api
    .post(`stores/${input.storeId}/photos`, {
      json: {
        kind: input.kind,
        fieldName: input.fieldName,
        contentType,
        sizeBytes: info.size ?? 0,
      },
    })
    .json()) as PresignUploadResponse;

  // 3. PUT raw bytes to the presigned URL. We use FileSystem.uploadAsync
  //    so the file is streamed instead of buffered into JS memory.
  const result = await FileSystem.uploadAsync(presigned.uploadUrl, input.localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: presigned.headers,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Photo upload failed (${result.status})`);
  }

  // 4. Hash + finalize. We hash on device so the server can verify.
  const base64 = await FileSystem.readAsStringAsync(input.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const sha256 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  await api.post(`photos/${presigned.photoId}/finalize`, { json: { sha256 } });

  return presigned.photoId;
}
