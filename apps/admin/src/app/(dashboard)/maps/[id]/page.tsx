'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PropertyImageDialog } from '@/components/property-image-dialog';
import { StoreEditDialog } from '@/components/store-edit-dialog';
import { AdminCompleteDialog } from '@/components/admin-complete-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useDeleteStore, useMap, useMapStores } from '@/lib/queries';
import { useAuthStore } from '@/lib/auth';
import { api } from '@/lib/api';
import { friendlyError } from '@/lib/friendly-error';
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

type DialogMode =
  | { kind: 'create-store' }
  | { kind: 'edit-store'; store: Store }
  | { kind: 'complete-store'; store: Store }
  | { kind: 'delete-store'; store: Store }
  | { kind: 'property'; store: Store };

export default function MapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: map, isLoading: mapLoading } = useMap(id);
  const { data: stores, isLoading: storesLoading } = useMapStores(id);
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === UserRole.ADMIN;
  const deleteStore = useDeleteStore(id);
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [downloading, setDownloading] = useState(false);

  if (mapLoading) return <p className="text-sm text-muted-foreground">Loading map…</p>;
  if (!map) return <p className="text-sm text-red-600">Map not found.</p>;

  /**
   * Excel download has to go through the authenticated `api` client (so
   * the JWT bearer is attached) and stream the response as a blob —
   * a plain `<a href>` opens a new tab without auth and the API correctly
   * rejects it as 401.
   */
  async function downloadExcel() {
    setDownloading(true);
    try {
      const blob = await api.get(`maps/${id}/excel`).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${map?.name || 'map'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(`Download failed: ${await friendlyError(err)}`);
    } finally {
      setDownloading(false);
    }
  }

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
        <Link href={`/maps/${id}/view`}>
          <Button>View on map</Button>
        </Link>
        {isAdmin && (
          <>
            <Button variant="secondary" onClick={() => setDialog({ kind: 'create-store' })}>
              + Add new store
            </Button>
            <Link href={`/maps/${id}/workers`}>
              <Button variant="secondary">Manage workers</Button>
            </Link>
            <Link href={`/maps/${id}/vendors`}>
              <Button variant="secondary">Manage vendors</Button>
            </Link>
            <Link href={`/maps/${id}/viewers`}>
              <Button variant="secondary">Manage viewers</Button>
            </Link>
            <Link href={`/maps/${id}/questions`}>
              <Button variant="secondary">Questions</Button>
            </Link>
            <Link href={`/maps/${id}/tag-alerts`}>
              <Button variant="secondary">Tag-alert recipients</Button>
            </Link>
          </>
        )}
        <Link href={`/maps/${id}/tag-alert-log`}>
          <Button variant="secondary">Tag-alert log</Button>
        </Link>
        <Button variant="secondary" onClick={downloadExcel} disabled={downloading}>
          {downloading ? 'Downloading…' : 'Download Excel'}
        </Button>
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
                  <th className="py-2 pr-4 font-medium">Actions</th>
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
                          onClick={() => setDialog({ kind: 'property', store: s })}
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
                      <div className="flex flex-wrap gap-1">
                        {isAdmin && (
                          <button
                            onClick={() => setDialog({ kind: 'edit-store', store: s })}
                            className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium text-white hover:bg-cyan-700"
                          >
                            Edit
                          </button>
                        )}
                        {isAdmin && s.markerColor !== 'red' && (
                          <button
                            onClick={() => setDialog({ kind: 'complete-store', store: s })}
                            className="rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                          >
                            Complete
                          </button>
                        )}
                        {s.markerColor === 'red' && (
                          <Link
                            href={`/maps/${id}/stores/${s.id}/completion`}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Detail
                          </Link>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setDialog({ kind: 'delete-store', store: s })}
                            disabled={deleteStore.isPending}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog?.kind === 'property' && (
        <PropertyImageDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          storeId={dialog.store.id}
          mapId={id}
          storeNumber={dialog.store.storeNumber}
          storeName={dialog.store.storeName}
          currentUrl={dialog.store.propertyImageUrl}
        />
      )}
      {dialog?.kind === 'create-store' && (
        <StoreEditDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          mode="create"
          mapId={id}
          taskColumns={map.taskColumns}
        />
      )}
      {dialog?.kind === 'edit-store' && (
        <StoreEditDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          mode="edit"
          mapId={id}
          taskColumns={map.taskColumns}
          store={dialog.store}
        />
      )}
      {dialog?.kind === 'complete-store' && (
        <AdminCompleteDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          store={dialog.store}
          map={map}
        />
      )}
      {dialog?.kind === 'delete-store' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Delete store #${dialog.store.storeNumber} ${dialog.store.storeName}?`}
          description="The store is soft-deleted (the row hides from the list, completion history is kept)."
          confirmLabel="Delete store"
          onConfirm={() => deleteStore.mutateAsync(dialog.store.id)}
        />
      )}
    </section>
  );
}
