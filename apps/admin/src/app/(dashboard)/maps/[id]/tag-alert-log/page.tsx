'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMap, useMapTagAlerts } from '@/lib/queries';

const STATUS_BADGE: Record<'pending' | 'sent' | 'failed', string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export default function TagAlertLogPage() {
  const { id } = useParams<{ id: string }>();
  const { data: map } = useMap(id);
  const { data: alerts, isLoading, error } = useMapTagAlerts(id);

  return (
    <section className="space-y-4">
      <header>
        <Link href={`/maps/${id}`} className="text-sm text-muted-foreground hover:text-brand">
          ← Back to map
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Tag-alert log</h1>
        <p className="text-sm text-muted-foreground">
          {map?.name ?? '—'} · {alerts?.length ?? 0} alert(s)
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {alerts && alerts.length === 0 && (
        <p className="text-sm text-muted-foreground">No tag alerts have been raised on this map.</p>
      )}

      {alerts && alerts.length > 0 && (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-md border p-4">
              <header className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{a.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    Raised by {a.raisedByName} · {new Date(a.raisedAt).toLocaleString()}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[a.emailStatus]}`}>
                  {a.emailStatus}
                  {a.emailStatus === 'sent' && a.emailSentAt && (
                    <span className="ml-1 opacity-70">
                      {new Date(a.emailSentAt).toLocaleString()}
                    </span>
                  )}
                </span>
              </header>
              <p className="whitespace-pre-wrap text-sm">{a.description}</p>
              {a.photoIds.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {a.photoIds.length} photo{a.photoIds.length === 1 ? '' : 's'} attached
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
