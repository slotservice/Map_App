'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog } from './ui/dialog';
import { useUpdateMap } from '@/lib/queries';
import { friendlyError } from '@/lib/friendly-error';

export function EditMapDialog({
  open,
  onOpenChange,
  mapId,
  currentName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mapId: string;
  currentName: string;
}) {
  const update = useUpdateMap();
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
    }
  }, [open, currentName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    if (trimmed === currentName) {
      onOpenChange(false);
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ id: mapId, name: trimmed });
      onOpenChange(false);
    } catch (err) {
      setError(await friendlyError(err));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (update.isPending) return;
        onOpenChange(o);
      }}
      title="Rename map"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Map name</span>
          <Input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
