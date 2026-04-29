'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useImportMap } from '@/lib/queries';

export function CreateMapDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const importMap = useImportMap();
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setFile(null);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError('Choose an Excel file');
    try {
      const res = await importMap.mutateAsync({ name, file });
      onOpenChange(false);
      reset();
      router.push(`/maps/${res.mapId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setError(msg);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!importMap.isPending) {
          onOpenChange(o);
          if (!o) reset();
        }
      }}
      title="Create new map"
      description="Upload an Excel sheet of stores. The first column must be Store #, the second Store Name, and Latitude / Longitude are required."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Name</span>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lawn — Week 1 2026"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Excel file</span>
          <Input
            required
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={importMap.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={importMap.isPending}>
            {importMap.isPending ? 'Importing…' : 'Create map'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
