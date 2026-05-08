'use client';

import { useState } from 'react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { api } from '@/lib/api';
import { sha256Hex } from '@/lib/sha256';
import { useQueryClient } from '@tanstack/react-query';
import type { PresignUploadResponse } from '@map-app/shared';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  mapId: string;
  storeNumber: string;
  storeName: string;
  currentUrl: string | null;
}

export function PropertyImageDialog({
  open,
  onOpenChange,
  storeId,
  mapId,
  storeNumber,
  storeName,
  currentUrl,
}: Props) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setFile(null);
    setError(null);
    onOpenChange(false);
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const presign = (await api
        .post(`stores/${storeId}/property-image`, {
          json: {
            kind: 'property_view',
            contentType: file.type || 'image/jpeg',
            sizeBytes: file.size,
          },
        })
        .json()) as PresignUploadResponse;

      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: presign.headers,
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`S3 upload failed (${putRes.status})`);
      }

      const buf = await file.arrayBuffer();
      const hex = await sha256Hex(buf);

      await api.post(`stores/${storeId}/property-image/${presign.photoId}/finalize`, {
        json: { sha256: hex },
      });

      qc.invalidateQueries({ queryKey: ['maps', mapId, 'stores'] });
      qc.invalidateQueries({ queryKey: ['stores', storeId] });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function clearImage() {
    setBusy(true);
    try {
      await api.delete(`stores/${storeId}/property-image`);
      qc.invalidateQueries({ queryKey: ['maps', mapId, 'stores'] });
      qc.invalidateQueries({ queryKey: ['stores', storeId] });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={`Property image — ${storeNumber} ${storeName}`}
      description="Workers see this on the Property View screen of the mobile app. Recommended: 4:3 overhead photo, ≤ 5 MB."
    >
      {currentUrl && (
        <div className="mb-4">
          <p className="mb-2 text-xs text-muted-foreground">Current image</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt="Property"
            className="aspect-[4/3] w-full rounded-md border object-cover"
          />
        </div>
      )}

      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">
            {currentUrl ? 'Replace with' : 'Upload'}
          </span>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-between gap-2">
          {currentUrl ? (
            <Button variant="destructive" disabled={busy} onClick={clearImage}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={upload} disabled={!file || busy}>
              {busy ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
