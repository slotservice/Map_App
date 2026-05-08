import { api } from './api';
import { sha256Hex } from './sha256';
import type { PhotoKind, PresignUploadResponse } from '@map-app/shared';

/**
 * Upload a single photo to a store, mirroring the mobile worker flow:
 *   1. presign  → POST /stores/:id/photos
 *   2. PUT to S3 with the returned signed URL + headers
 *   3. compute SHA-256 of the bytes (Web Crypto preferred; pure-JS fallback
 *      for plain-HTTP demo URLs where window.crypto.subtle is undefined)
 *   4. finalize → POST /photos/:id/finalize { sha256 }
 *
 * Throws on any step that fails. Returns the persisted photo id once
 * the server has verified the bytes landed.
 */
export async function uploadStorePhoto(
  storeId: string,
  file: File,
  kind: PhotoKind,
  fieldName?: string,
): Promise<string> {
  const presign = (await api
    .post(`stores/${storeId}/photos`, {
      json: {
        kind,
        ...(fieldName ? { fieldName } : {}),
        contentType: file.type || 'image/jpeg',
        sizeBytes: file.size,
      },
    })
    .json()) as PresignUploadResponse;

  const buf = await file.arrayBuffer();

  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: presign.headers,
    body: buf,
  });
  if (!putRes.ok) {
    throw new Error(`Photo upload to storage failed (HTTP ${putRes.status})`);
  }

  const sha256 = await sha256Hex(buf);

  await api.post(`photos/${presign.photoId}/finalize`, { json: { sha256 } });

  return presign.photoId;
}
