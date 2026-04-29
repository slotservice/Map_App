'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useMap, useMapStores } from '@/lib/queries';
import type { MarkerColor } from '@map-app/shared';

const COLOR_LABEL: Record<MarkerColor, string> = {
  blue: 'Blue (needs scheduled)',
  orange: 'Orange (mixed)',
  yellow: 'Yellow (in progress)',
  red: 'Red (complete)',
};

const COLOR_BG: Record<MarkerColor, string> = {
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-600',
};

export default function MapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: map, isLoading: mapLoading } = useMap(id);
  const { data: stores, isLoading: storesLoading } = useMapStores(id);

  if (mapLoading) return <p className="text-sm text-muted-foreground">Loading map…</p>;
  if (!map) return <p className="text-sm text-red-600">Map not found.</p>;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  return (
    <section className="space-y-6">
      <header>
        <Link href="/maps" className="text-sm text-muted-foreground hover:text-brand">
          ← All maps
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{map.name}</h1>
        <p className="text-sm text-muted-foreground">
          Imported from {map.sourceFilename ?? '—'} · {map.taskColumns.length} task col(s),{' '}
          {map.countColumns.length} count col(s)
        </p>
      </header>

      <nav className="flex gap-3">
        <Link href={`/maps/${id}/workers`}>
          <Button variant="secondary">Manage workers</Button>
        </Link>
        <Link href={`/maps/${id}/vendors`}>
          <Button variant="secondary">Manage vendors</Button>
        </Link>
        <Link href={`/maps/${id}/tag-alerts`}>
          <Button variant="secondary">Tag-alert recipients</Button>
        </Link>
        <a href={`${apiBase}/api/v1/maps/${id}/excel`} target="_blank" rel="noreferrer">
          <Button>Download Excel</Button>
        </a>
      </nav>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Stores ({stores?.length ?? 0})</h2>
        {storesLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {stores && stores.length === 0 && (
          <p className="text-sm text-muted-foreground">No stores in this map.</p>
        )}
        {stores && stores.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">State</th>
                  <th className="py-2 pr-4 font-medium">Address</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  {map.taskColumns.map((t) => (
                    <th key={t} className="py-2 pr-4 font-medium">
                      {t.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2 pr-4 font-medium">{s.storeNumber}</td>
                    <td className="py-2 pr-4">{s.storeName}</td>
                    <td className="py-2 pr-4">{s.state ?? '—'}</td>
                    <td className="py-2 pr-4">{s.address ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${COLOR_BG[s.markerColor]}`}
                        title={COLOR_LABEL[s.markerColor]}
                      />
                    </td>
                    {map.taskColumns.map((t) => {
                      const task = s.tasks.find((x) => x.name === t);
                      return (
                        <td key={t} className="py-2 pr-4 text-xs">
                          {task ? task.currentStatus.replace(/_/g, ' ') : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
