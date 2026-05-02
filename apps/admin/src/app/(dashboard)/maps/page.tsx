'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CreateMapDialog } from '@/components/create-map-dialog';
import { useDeleteMap, useMaps } from '@/lib/queries';

const PAGE_SIZE = 25;

export default function MapsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useMaps();
  const deleteMap = useDeleteMap();

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((m) => m.name.toLowerCase().includes(q));
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section>
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Maps</h1>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search maps…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-56 rounded-md border px-3 py-2 text-sm"
            aria-label="Search maps"
          />
          <Button onClick={() => setDialogOpen(true)}>+ Create map</Button>
        </div>
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

      {data && data.length > 0 && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No maps match &ldquo;{search}&rdquo;.
        </div>
      )}

      {filtered.length > 0 && (
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
            {pageRows.map((m) => (
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

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">
            Page {safePage} of {totalPages} ({filtered.length} map{filtered.length === 1 ? '' : 's'})
          </span>
          <div className="flex gap-2">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </nav>
      )}

      <CreateMapDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </section>
  );
}
