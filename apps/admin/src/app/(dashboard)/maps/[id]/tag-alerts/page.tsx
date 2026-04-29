'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Map as MapDto } from '@map-app/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMap } from '@/lib/queries';

export default function TagAlertRecipientsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: map } = useMap(id);
  const qc = useQueryClient();
  const [recipients, setRecipients] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (map) setRecipients(map.tagAlertRecipients);
  }, [map]);

  const save = useMutation({
    mutationFn: async (next: string[]) =>
      api.patch(`maps/${id}`, { json: { tagAlertRecipients: next } }).json<MapDto>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maps', id] }),
  });

  function add() {
    setError(null);
    const v = draft.trim().toLowerCase();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError('Not a valid email');
    if (recipients.includes(v)) return setError('Already in the list');
    const next = [...recipients, v];
    setRecipients(next);
    setDraft('');
    save.mutate(next);
  }

  function remove(email: string) {
    const next = recipients.filter((e) => e !== email);
    setRecipients(next);
    save.mutate(next);
  }

  return (
    <section className="space-y-6 max-w-xl">
      <header>
        <Link href={`/maps/${id}`} className="text-sm text-muted-foreground hover:text-brand">
          ← Back to map
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Tag-alert recipients</h1>
        <p className="text-sm text-muted-foreground">
          When a worker raises a tag alert on this map, an email is sent to every address below.
        </p>
      </header>

      <div className="flex gap-2">
        <Input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="someone@example.com"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button onClick={add} disabled={save.isPending}>
          Add
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {recipients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recipients configured.</p>
      ) : (
        <ul className="space-y-1">
          {recipients.map((email) => (
            <li key={email} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{email}</span>
              <button
                onClick={() => remove(email)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {save.isError && (
        <p className="text-sm text-red-600">
          Save failed: {(save.error as Error).message}
        </p>
      )}
    </section>
  );
}
