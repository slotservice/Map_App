'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { UserRole, type Question } from '@map-app/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useCreateQuestion,
  useDeleteQuestion,
  useMap,
  useMapQuestions,
  useUpdateQuestion,
} from '@/lib/queries';
import { useAuthStore } from '@/lib/auth';
import { friendlyError } from '@/lib/friendly-error';

export default function QuestionsPage() {
  const { id: mapId } = useParams<{ id: string }>();
  const { data: map } = useMap(mapId);
  const { data: questions, isLoading, error } = useMapQuestions(mapId);
  const remove = useDeleteQuestion(mapId);
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === UserRole.ADMIN;

  const [editTarget, setEditTarget] = useState<Question | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);

  return (
    <section className="space-y-4">
      <header>
        <Link href="/maps" className="text-sm text-muted-foreground hover:text-brand">
          ← All maps
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Questions</h1>
            <p className="text-sm text-muted-foreground">
              For map <strong>{map?.name ?? '…'}</strong>
            </p>
          </div>
          {isAdmin && <Button onClick={() => setEditTarget('new')}>+ Add new question</Button>}
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {questions && questions.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No questions yet for this map.
        </div>
      )}

      {questions && questions.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium" style={{ width: 50 }}>
                No
              </th>
              <th className="py-2 pr-4 font-medium">Question</th>
              <th className="py-2 pr-4 font-medium">Created</th>
              {isAdmin && <th className="py-2 pr-4 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={q.id} className="border-b">
                <td className="py-3 pr-4">{i + 1}</td>
                <td className="py-3 pr-4">{q.title}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {new Date(q.createdAt).toLocaleDateString()}
                </td>
                {isAdmin && (
                  <td className="py-3 pr-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditTarget(q)}
                        className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium text-white hover:bg-cyan-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(q)}
                        disabled={remove.isPending}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editTarget !== null && isAdmin && (
        <QuestionDialog
          mapId={mapId}
          target={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && isAdmin && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          title={`Delete "${deleteTarget.title}"?`}
          description="The question is removed from this map's list."
          confirmLabel="Delete question"
          onConfirm={() => remove.mutateAsync(deleteTarget.id)}
        />
      )}
    </section>
  );
}

function QuestionDialog({
  mapId,
  target,
  onClose,
}: {
  mapId: string;
  target: Question | 'new';
  onClose: () => void;
}) {
  const create = useCreateQuestion(mapId);
  const update = useUpdateQuestion(mapId);
  const isEdit = target !== 'new';
  const [title, setTitle] = useState(isEdit ? target.title : '');
  const [error, setError] = useState<string | null>(null);
  const isPending = create.isPending || update.isPending;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }
    setError(null);
    try {
      if (isEdit) {
        await update.mutateAsync({ id: target.id, body: { title: trimmed } });
      } else {
        await create.mutateAsync({ title: trimmed });
      }
      onClose();
    } catch (err) {
      setError(await friendlyError(err));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !isPending) onClose();
      }}
      title={isEdit ? 'Update question' : 'Add new question'}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Title</span>
          <Input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
