'use client';

import { useQuery } from '@tanstack/react-query';
import type { MapSummary } from '@map-app/shared';
import { api } from '@/lib/api';

export default function MapsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['maps'],
    queryFn: () => api.get('maps').json<MapSummary[]>(),
  });

  return (
    <section>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Maps</h1>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">
          + Create map
        </button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Stores</th>
              <th className="py-2 pr-4">Completed</th>
              <th className="py-2 pr-4">Assigned</th>
              <th className="py-2 pr-4">Created</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="py-2 pr-4 font-medium">{m.name}</td>
                <td className="py-2 pr-4">{m.storeCount}</td>
                <td className="py-2 pr-4">{m.completedStoreCount}</td>
                <td className="py-2 pr-4">{m.assignedUserCount}</td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2 pr-4">
                  <a className="text-brand underline" href={`/maps/${m.id}`}>
                    Detail
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
