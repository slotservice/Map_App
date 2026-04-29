'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PropertyImageDialog } from '@/components/property-image-dialog';
import { useMap, useMapStores } from '@/lib/queries';
import { useAuthStore } from '@/lib/auth';
import { UserRole, type MarkerColor, type Store } from '@map-app/shared';

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
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === UserRole.ADMIN;
  const [propertyTarget, setPropertyTarget] = useState<Store | null>(null);

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
          {map.sourceFilename && <>Imported from {map.sourceFilename} · </>}
          {map.taskColumns.length} task col(s), {map.countColumns.length} count col(s)
        </p>
      </header>

      <nav className="flex flex-wrap gap-3">
        {isAdmin && (
          <>
            <Link href={`/maps/${id}/workers`}>
              <Button variant="secondary">Manage workers</Button>
            </Link>
            <Link href={`/maps/${id}/vendors`}>
              <Button variant="secondary">Manage vendors</Button>
            </Link>
            <Link href={`/maps/${id}/viewers`}>
              <Button variant="secondary">Manage viewers</Button>
            </Link>
            <Link href={`/maps/${id}/tag-alerts`}>
              <Button variant="secondary">Tag-alert recipients</Button>
            </Link>
          </>
        )}
        <Link href={`/maps/${id}/tag-alert-log`}>
          <Button variant="secondary">Tag-alert log</Button>
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
                  <th className="py-2 pr-4 font-medium">Property</th>
                  <th className="py-2 pr-4 font-medium"></th>
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
                    <td className="py-2 pr-4">
                      {isAdmin ? (
                        <button
                          onClick={() => setPropertyTarget(s)}
                          className="flex items-center gap-2 text-sm text-brand hover:underline"
                        >
                          {s.propertyImageUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={s.propertyImageUrl}
                                alt=""
                                className="h-8 w-8 rounded border object-cover"
                              />
                              <span>Edit</span>
                            </>
                          ) : (
                            <span>+ Add</span>
                          )}
                        </button>
                      ) : s.propertyImageUrl ? (
                        <a
                          href={s.propertyImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-brand hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {s.markerColor === 'red' ? (
                        <Link
                          href={`/maps/${id}/stores/${s.id}/completion`}
                          className="text-sm text-brand hover:underline"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {propertyTarget && (
        <PropertyImageDialog
          open={!!propertyTarget}
          onOpenChange={(o) => !o && setPropertyTarget(null)}
          storeId={propertyTarget.id}
          mapId={id}
          storeNumber={propertyTarget.storeNumber}
          storeName={propertyTarget.storeName}
          currentUrl={propertyTarget.propertyImageUrl}
        />
      )}
    </section>
  );
}
