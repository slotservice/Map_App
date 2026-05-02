'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface AuditEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  payload: unknown;
  at: string;
}

interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const pageSize = 50;

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  // datetime-local emits "YYYY-MM-DDTHH:mm" — append :00Z so the API
  // gets a parseable ISO string and treats user input as UTC for safety.
  if (from) qs.set('from', `${from}:00Z`);
  if (to) qs.set('to', `${to}:00Z`);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-log', page, from, to],
    queryFn: () => api.get(`audit-log?${qs.toString()}`).json<AuditPage>(),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const resetPage = () => setPage(1);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Every map / user / assignment change is recorded here.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col">
            <span className="text-xs text-muted-foreground">From</span>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                resetPage();
              }}
              className="rounded-md border px-2 py-1"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-muted-foreground">To</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                resetPage();
              }}
              className="rounded-md border px-2 py-1"
            />
          </label>
          {(from || to) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFrom('');
                setTo('');
                resetPage();
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No entries.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Actor</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Resource</th>
                  <th className="py-2 pr-4 font-medium">Payload</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id} className="border-b align-top">
                    <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                      {new Date(e.at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{e.actorEmail ?? '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{e.action}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {e.resourceType}
                      {e.resourceId ? ` / ${e.resourceId.slice(0, 8)}…` : ''}
                    </td>
                    <td className="py-2 pr-4 max-w-xl">
                      <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
