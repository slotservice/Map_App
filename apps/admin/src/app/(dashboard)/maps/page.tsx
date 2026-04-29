'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CreateMapDialog } from '@/components/create-map-dialog';
import { useDeleteMap, useMaps } from '@/lib/queries';

export default function MapsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, error } = useMaps();
  const deleteMap = useDeleteMap();

  return (
    <section>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Maps</h1>
        <Button onClick={() => setDialogOpen(true)}>+ Create map</Button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No maps yet. Click <strong>Create map</strong> to upload your first Excel.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Stores</th>
              <th className="py-2 pr-4 font-medium">Completed</th>
              <th className="py-2 pr-4 font-medium">Assigned</th>
              <th className="py-2 pr-4 font-medium">Created</th>
              <th className="py-2 pr-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="py-3 pr-4 font-medium">
                  <Link href={`/maps/${m.id}`} className="hover:text-brand">
                    {m.name}
                  </Link>
                </td>
                <td className="py-3 pr-4">{m.storeCount}</td>
                <td className="py-3 pr-4">
                  {m.completedStoreCount}
                  {m.storeCount > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({Math.round((m.completedStoreCount / m.storeCount) * 100)}%)
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4">{m.assignedUserCount}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex gap-2">
                    <Link href={`/maps/${m.id}`} className="text-sm text-brand hover:underline">
                      Open
                    </Link>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${m.name}"? Soft-delete (reversible).`)) {
                          deleteMap.mutate(m.id);
                        }
                      }}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <CreateMapDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </section>
  );
}
