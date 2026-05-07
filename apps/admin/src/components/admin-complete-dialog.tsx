'use client';

import { useEffect, useState } from 'react';
import { PhotoKind, type Map as MapDto, type Store, UserRole } from '@map-app/shared';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog } from './ui/dialog';
import { useAdminComplete, useMapAssignments } from '@/lib/queries';
import { uploadStorePhoto } from '@/lib/photo-upload';
import { friendlyError } from '@/lib/friendly-error';

interface PhotoPair {
  fieldName: string;
  before: File | null;
  after: File | null;
}

export function AdminCompleteDialog({
  open,
  onOpenChange,
  store,
  map,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  store: Store;
  map: MapDto;
}) {
  const adminComplete = useAdminComplete(store.mapId);
  const { data: workers } = useMapAssignments(store.mapId, UserRole.WORKER);

  const [workerId, setWorkerId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [generalComments, setGeneralComments] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [signature, setSignature] = useState<File | null>(null);
  const [pairs, setPairs] = useState<PhotoPair[]>([
    { fieldName: '', before: null, after: null },
  ]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWorkerId(workers?.[0]?.userId ?? '');
    setFirstName('');
    setLastName('');
    setGeneralComments('');
    setCompletedAt(new Date().toISOString().slice(0, 16)); // local datetime input default
    setSignature(null);
    setPairs([{ fieldName: '', before: null, after: null }]);
    const c: Record<string, string> = {};
    for (const k of map.countColumns) c[k] = '0';
    setCounts(c);
    setBusy(false);
    setError(null);
    setProgress(null);
  }, [open, workers, map.countColumns]);

  function close() {
    if (busy) return;
    onOpenChange(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workerId) {
      setError('Pick a worker to attribute the completion to');
      return;
    }
    if (!signature) {
      setError('Signature image is required');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required');
      return;
    }
    const validPairs = pairs.filter((p) => p.before || p.after);
    if (validPairs.length === 0) {
      setError('Add at least one before/after photo');
      return;
    }

    const numericCounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(counts)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        setError(`Count for "${k}" must be a non-negative integer`);
        return;
      }
      numericCounts[k] = n;
    }

    setBusy(true);
    setError(null);
    try {
      setProgress('Uploading signature…');
      const signatureId = await uploadStorePhoto(store.id, signature, PhotoKind.SIGNATURE);

      const beforeIds: string[] = [];
      const afterIds: string[] = [];
      let i = 0;
      for (const p of validPairs) {
        i += 1;
        if (p.before) {
          setProgress(`Uploading before photo ${i}/${validPairs.length}…`);
          beforeIds.push(
            await uploadStorePhoto(store.id, p.before, PhotoKind.BEFORE, p.fieldName || undefined),
          );
        }
        if (p.after) {
          setProgress(`Uploading after photo ${i}/${validPairs.length}…`);
          afterIds.push(
            await uploadStorePhoto(store.id, p.after, PhotoKind.AFTER, p.fieldName || undefined),
          );
        }
      }

      setProgress('Recording completion…');
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      // datetime-local has no offset; treat the entered value as local and emit ISO with current offset.
      const localDate = new Date(completedAt);
      await adminComplete.mutateAsync({
        storeId: store.id,
        body: {
          workerId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          signaturePhotoId: signatureId,
          generalComments,
          counts: numericCounts,
          deviceTimezone: tz,
          completedAt: localDate.toISOString(),
          beforePhotoIds: beforeIds,
          afterPhotoIds: afterIds,
        },
      });
      onOpenChange(false);
    } catch (err) {
      setError(await friendlyError(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function updatePair(idx: number, patch: Partial<PhotoPair>) {
    setPairs((p) => p.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }
  function addPair() {
    setPairs((p) => [...p, { fieldName: '', before: null, after: null }]);
  }
  function removePair(idx: number) {
    setPairs((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={`Manual complete — store #${store.storeNumber}`}
      description="Use this when a worker finished a job but didn't log it through the app. Photos and signature are uploaded to storage just like the worker flow."
    >
      <form onSubmit={onSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              Completed by <span className="text-red-600">*</span>
            </span>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              required
            >
              {(!workers || workers.length === 0) && (
                <option value="">No workers assigned to this map</option>
              )}
              {workers?.map((w) => (
                <option key={w.userId} value={w.userId}>
                  {w.firstName} {w.lastName} ({w.email})
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Completion date</span>
            <Input
              type="datetime-local"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              First name <span className="text-red-600">*</span>
            </span>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              Last name <span className="text-red-600">*</span>
            </span>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">General comments</span>
          <textarea
            value={generalComments}
            onChange={(e) => setGeneralComments(e.target.value)}
            rows={2}
            maxLength={4000}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Before / after photos</legend>
          <div className="space-y-3">
            {pairs.map((pair, idx) => (
              <div key={idx} className="rounded-md border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Input
                    placeholder="Field name (e.g. 'Crash bars')"
                    value={pair.fieldName}
                    onChange={(e) => updatePair(idx, { fieldName: e.target.value })}
                  />
                  {pairs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePair(idx)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1 text-xs text-muted-foreground">
                    Before
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => updatePair(idx, { before: e.target.files?.[0] ?? null })}
                    />
                  </label>
                  <label className="block space-y-1 text-xs text-muted-foreground">
                    After
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => updatePair(idx, { after: e.target.files?.[0] ?? null })}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPair}
            className="mt-2 text-xs text-brand hover:underline"
          >
            + Add more
          </button>
        </fieldset>

        <label className="block space-y-1">
          <span className="text-sm font-medium">
            Signature image <span className="text-red-600">*</span>
          </span>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setSignature(e.target.files?.[0] ?? null)}
            required
          />
        </label>

        {map.countColumns.length > 0 && (
          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Counts</legend>
            <div className="grid grid-cols-2 gap-3">
              {map.countColumns.map((c) => (
                <label key={c} className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{c.replace(/_/g, ' ')}</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={counts[c] ?? '0'}
                    onChange={(e) => setCounts((s) => ({ ...s, [c]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
        {error && <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>}

        <div className="sticky bottom-0 flex justify-end gap-2 bg-background pt-2">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Complete'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
