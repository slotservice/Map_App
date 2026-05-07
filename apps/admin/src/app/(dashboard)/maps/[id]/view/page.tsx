'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useMap, useMapStores } from '@/lib/queries';

// Leaflet touches `window` at module init; render only on the client.
const MapMarkerView = dynamic(
  () => import('@/components/map-marker-view').then((m) => m.MapMarkerView),
  {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground">Loading map…</p>,
  },
);

export default function MapViewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: map, isLoading: mapLoading } = useMap(id);
  const { data: stores, isLoading: storesLoading, error } = useMapStores(id);

  if (mapLoading || storesLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!map) return <p className="text-sm text-red-600">Map not found.</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/maps" className="text-sm text-muted-foreground hover:text-brand">
            ← All maps
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{map.name}</h1>
          <p className="text-sm text-muted-foreground">Map view · {stores?.length ?? 0} stores</p>
        </div>
        <Link href={`/maps/${id}`}>
          <Button variant="secondary">Back to detail</Button>
        </Link>
      </header>

      {stores && stores.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          This map has no stores.
        </div>
      ) : (
        <MapMarkerView stores={stores ?? []} mapId={id} height={640} />
      )}
    </section>
  );
}
