'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateMapDialog } from '@/components/create-map-dialog';
import { EditMapDialog } from '@/components/edit-map-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useDeleteMap, useMaps } from '@/lib/queries';
import { UserRole, type MapSummary } from '@map-app/shared';
import { useAuthStore } from '@/lib/auth';

const PAGE_SIZE = 25;

export default function MapsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MapSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MapSummary | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useMaps();
  const deleteMap = useDeleteMap();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === UserRole.ADMIN;

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
          <Input
            type="search"
            placeholder="Search maps…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-56"
            aria-label="Search maps"
          />
          {isAdmin && <Button onClick={() => setCreateOpen(true)}>+ Create map</Button>}
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No maps yet.{' '}
            {isAdmin ? (
              <>
                Click <strong>Create map</strong> to upload your first Excel.
              </>
            ) : (
              "You haven't been assigned to any maps yet."
            )}
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
              <th className="py-2 pr-4 font-medium">Actions</th>
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
                  <div className="flex flex-wrap gap-1.5">
                    <ActionLink href={`/maps/${m.id}`} variant="primary" label="Detail" />
                    <ActionLink
                      href={`/maps/${m.id}/view`}
                      variant="info"
                      label="Map"
                      icon="globe"
                    />
                    {isAdmin && (
                      <>
                        <ActionLink
                          href={`/maps/${m.id}/workers`}
                          variant="warning"
                          label="Manage Workers"
                        />
                        <ActionLink
                          href={`/maps/${m.id}/tag-alerts`}
                          variant="warning"
                          label="Tag Alerts"
                        />
                        <ActionButton
                          onClick={() => setEditTarget(m)}
                          variant="info"
                          label="Edit"
                        />
                        <ActionButton
                          onClick={() => setDeleteTarget(m)}
                          variant="danger"
                          label="Delete"
                          disabled={deleteMap.isPending}
                        />
                      </>
                    )}
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

      <CreateMapDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editTarget && (
        <EditMapDialog
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          mapId={editTarget.id}
          currentName={editTarget.name}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          title={`Delete "${deleteTarget.name}"?`}
          description="The map is soft-deleted and can be restored — but it disappears from the list right away."
          confirmLabel="Delete map"
          onConfirm={() => deleteMap.mutateAsync(deleteTarget.id)}
        />
      )}
    </section>
  );
}

type ActionVariant = 'primary' | 'info' | 'warning' | 'danger';

const ACTION_CLASSES: Record<ActionVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  info: 'bg-cyan-600 text-white hover:bg-cyan-700',
  warning: 'bg-amber-500 text-white hover:bg-amber-600',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const ACTION_BASE =
  'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function ActionLink({
  href,
  variant,
  label,
  icon,
}: {
  href: string;
  variant: ActionVariant;
  label: string;
  icon?: 'globe';
}) {
  // typedRoutes treats dynamic strings as opaque; we know the URL is well-formed
  // because the only callers build it from a verified mapId.
  return (
    <Link href={href as Route} className={`${ACTION_BASE} ${ACTION_CLASSES[variant]}`}>
      {icon === 'globe' && <GlobeIcon />}
      {label}
    </Link>
  );
}

function ActionButton({
  onClick,
  variant,
  label,
  disabled,
}: {
  onClick: () => void;
  variant: ActionVariant;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${ACTION_BASE} ${ACTION_CLASSES[variant]}`}
    >
      {label}
    </button>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
    </svg>
  );
}
