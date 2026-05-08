'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import type { UserRole } from '@map-app/shared';
import { Button } from './ui/button';
import { ConfirmDialog } from './confirm-dialog';
import {
  type MapAssignmentRow,
  useAssignMap,
  useMap,
  useMapAssignments,
  useUnassignMap,
  useUsers,
} from '@/lib/queries';

function subtitleFor(label: string): string {
  switch (label) {
    case 'Worker':
      return 'Workers can only open this map in the mobile app once assigned here.';
    case 'Vendor':
      return 'Vendors only see maps you assign here.';
    case 'Viewer':
      return 'Viewers see this map read-only in the admin panel only.';
    default:
      return `${label}s assigned to this map will see it.`;
  }
}

function listPathFor(label: string): Route {
  switch (label) {
    case 'Worker':
      return '/workers';
    case 'Vendor':
      return '/vendors';
    case 'Viewer':
      return '/viewers';
    default:
      return '/workers';
  }
}

/**
 * Per-map assignment manager. Used by both /maps/:id/workers and
 * /maps/:id/vendors — driven by the role param.
 */
export function MapAssignmentList({
  mapId,
  role,
  label,
}: {
  mapId: string;
  role: UserRole;
  label: string;
}) {
  const { data: map } = useMap(mapId);
  const { data: assigned } = useMapAssignments(mapId, role);
  const { data: allUsers } = useUsers(role);
  const assign = useAssignMap(mapId);
  const unassign = useUnassignMap(mapId);
  const [selected, setSelected] = useState('');
  const [removeTarget, setRemoveTarget] = useState<MapAssignmentRow | null>(null);

  const unassigned = useMemo(() => {
    const assignedIds = new Set((assigned ?? []).map((a) => a.userId));
    return (allUsers ?? []).filter((u) => !assignedIds.has(u.id) && u.status === 'active');
  }, [assigned, allUsers]);

  return (
    <section className="space-y-6">
      <header>
        <Link href={`/maps/${mapId}`} className="text-sm text-muted-foreground hover:text-brand">
          ← Back to map
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{label}s on {map?.name ?? '…'}</h1>
        <p className="text-sm text-muted-foreground">{subtitleFor(label)}</p>
      </header>

      {allUsers && allUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No {label.toLowerCase()}s exist yet. Add one in the{' '}
          <Link href={listPathFor(label)} className="text-brand hover:underline">
            {label} list
          </Link>{' '}
          first, then come back here to assign them to this map.
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a {label.toLowerCase()} to add…</option>
            {unassigned.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.email})
              </option>
            ))}
          </select>
          <Button
            disabled={!selected || assign.isPending}
            onClick={async () => {
              await assign.mutateAsync({ userId: selected, role });
              setSelected('');
            }}
          >
            {assign.isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Assigned ({assigned?.length ?? 0})</h2>
        {assigned && assigned.length === 0 && (
          <p className="text-sm text-muted-foreground">
            None yet. Pick a {label.toLowerCase()} above and click Add.
          </p>
        )}
        {assigned && assigned.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((row) => (
                <tr key={row.userId} className="border-b">
                  <td className="py-3 pr-4 font-medium">
                    {row.firstName} {row.lastName}
                  </td>
                  <td className="py-3 pr-4">{row.email}</td>
                  <td className="py-3 pr-4">
                    <button
                      onClick={() => setRemoveTarget(row)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {removeTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoveTarget(null)}
          title={`Remove ${removeTarget.email}?`}
          description={`The ${label.toLowerCase()} will no longer see this map. Their account isn't affected.`}
          confirmLabel={`Remove ${label.toLowerCase()}`}
          onConfirm={() => unassign.mutateAsync(removeTarget.userId)}
        />
      )}
    </section>
  );
}
