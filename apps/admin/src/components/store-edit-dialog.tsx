'use client';

import { useEffect, useState } from 'react';
import { TaskStatus, type Store } from '@map-app/shared';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog } from './ui/dialog';
import { useCreateStore, useUpdateStore } from '@/lib/queries';
import { friendlyError } from '@/lib/friendly-error';

type Mode = 'create' | 'edit';

export function StoreEditDialog({
  open,
  onOpenChange,
  mode,
  mapId,
  taskColumns,
  store,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: Mode;
  mapId: string;
  taskColumns: string[];
  store?: Store; // required when mode === 'edit'
}) {
  const create = useCreateStore(mapId);
  const update = useUpdateStore(mapId);

  const [storeNumber, setStoreNumber] = useState('');
  const [storeName, setStoreName] = useState('');
  const [state, setState] = useState('');
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [type, setType] = useState('');
  const [manager, setManager] = useState('');
  const [regional, setRegional] = useState('');
  const [notes, setNotes] = useState('');
  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && store) {
      setStoreNumber(store.storeNumber);
      setStoreName(store.storeName);
      setState(store.state ?? '');
      setAddress(store.address ?? '');
      setZip(store.zip ?? '');
      setLatitude(String(store.latitude));
      setLongitude(String(store.longitude));
      setType(store.type ?? '');
      setManager(store.manager ?? '');
      setRegional(store.regional ?? '');
      setNotes(store.notes ?? '');
      const ts: Record<string, TaskStatus> = {};
      for (const t of store.tasks) ts[t.name] = t.currentStatus;
      setTaskStatuses(ts);
    } else {
      setStoreNumber('');
      setStoreName('');
      setState('');
      setAddress('');
      setZip('');
      setLatitude('');
      setLongitude('');
      setType('');
      setManager('');
      setRegional('');
      setNotes('');
      const ts: Record<string, TaskStatus> = {};
      for (const t of taskColumns) ts[t] = TaskStatus.NEEDS_SCHEDULED;
      setTaskStatuses(ts);
    }
    setError(null);
  }, [open, mode, store, taskColumns]);

  const isPending = create.isPending || update.isPending;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setError('Latitude and longitude must be numbers');
      return;
    }
    const common = {
      storeNumber: storeNumber.trim(),
      storeName: storeName.trim(),
      state: state.trim() || undefined,
      address: address.trim() || undefined,
      zip: zip.trim() || undefined,
      latitude: lat,
      longitude: lon,
      type: type.trim() || undefined,
      manager: manager.trim() || undefined,
      regional: regional.trim() || undefined,
      notes: notes.trim() || undefined,
      taskStatuses: Object.keys(taskStatuses).length > 0 ? taskStatuses : undefined,
    };
    try {
      if (mode === 'create') {
        await create.mutateAsync(common);
      } else if (store) {
        await update.mutateAsync({ id: store.id, ...common });
      }
      onOpenChange(false);
    } catch (err) {
      setError(await friendlyError(err));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (isPending) return;
        onOpenChange(o);
      }}
      title={mode === 'create' ? 'Add new store' : `Edit store #${store?.storeNumber ?? ''}`}
    >
      <form onSubmit={onSubmit} className="max-h-[70vh] overflow-y-auto space-y-3 pr-1">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Store #" required>
            <Input value={storeNumber} onChange={(e) => setStoreNumber(e.target.value)} required />
          </Field>
          <Field label="Store name" required>
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
          </Field>
          <Field label="State">
            <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={20} />
          </Field>
          <Field label="Zip">
            <Input value={zip} onChange={(e) => setZip(e.target.value)} maxLength={20} />
          </Field>
          <Field label="Address" full>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={255} />
          </Field>
          <Field label="Latitude" required>
            <Input
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              required
              inputMode="decimal"
            />
          </Field>
          <Field label="Longitude" required>
            <Input
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              required
              inputMode="decimal"
            />
          </Field>
          <Field label="Type">
            <Input value={type} onChange={(e) => setType(e.target.value)} maxLength={50} />
          </Field>
          <Field label="Manager">
            <Input value={manager} onChange={(e) => setManager(e.target.value)} maxLength={100} />
          </Field>
          <Field label="Regional">
            <Input value={regional} onChange={(e) => setRegional(e.target.value)} maxLength={100} />
          </Field>
        </div>
        <Field label="Notes" full>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </Field>

        {taskColumns.length > 0 && (
          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Task statuses</legend>
            <div className="space-y-2">
              {taskColumns.map((name) => (
                <label key={name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{name.replace(/_/g, ' ')}</span>
                  <select
                    value={taskStatuses[name] ?? TaskStatus.NEEDS_SCHEDULED}
                    onChange={(e) =>
                      setTaskStatuses((s) => ({ ...s, [name]: e.target.value as TaskStatus }))
                    }
                    className="rounded-md border bg-background px-2 py-1 text-sm"
                  >
                    <option value={TaskStatus.NEEDS_SCHEDULED}>Needs Scheduled</option>
                    <option value={TaskStatus.SCHEDULED_OR_COMPLETE}>
                      Complete or scheduled already
                    </option>
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {error && <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>}

        <div className="sticky bottom-0 flex justify-end gap-2 bg-background pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({
  label,
  children,
  required,
  full,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`block space-y-1 ${full ? 'col-span-2' : ''}`}>
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}
