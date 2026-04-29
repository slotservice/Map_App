'use client';

import { useState } from 'react';
import { UserRole } from '@map-app/shared';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog } from './ui/dialog';
import {
  useCreateUser,
  useDeleteUser,
  useResetPassword,
  useUpdateUser,
  useUsers,
} from '@/lib/queries';

/**
 * Reusable list+CRUD UI for either workers or vendors. The only
 * difference between the two pages is the role passed in here.
 */
export function UserList({ role, label }: { role: UserRole; label: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; email: string } | null>(null);
  const { data, isLoading, error } = useUsers(role);
  const update = useUpdateUser();
  const remove = useDeleteUser();

  return (
    <section>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{label}s</h1>
        <Button onClick={() => setCreateOpen(true)}>+ Add {label.toLowerCase()}</Button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No {label.toLowerCase()}s yet. Click <strong>Add {label.toLowerCase()}</strong>.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Phone</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Created</th>
              <th className="py-2 pr-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="py-3 pr-4 font-medium">
                  {u.firstName} {u.lastName}
                </td>
                <td className="py-3 pr-4">{u.email}</td>
                <td className="py-3 pr-4 text-muted-foreground">{u.phone ?? '—'}</td>
                <td className="py-3 pr-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      u.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <button
                      onClick={() => setResetTarget({ id: u.id, email: u.email })}
                      className="text-brand hover:underline"
                    >
                      Reset password
                    </button>
                    <button
                      onClick={() =>
                        update.mutate({
                          id: u.id,
                          status: u.status === 'active' ? 'blocked' : 'active',
                        })
                      }
                      className="text-blue-600 hover:underline"
                    >
                      {u.status === 'active' ? 'Block' : 'Unblock'}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Soft-delete ${u.email}?`)) remove.mutate(u.id);
                      }}
                      className="text-red-600 hover:underline"
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

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        role={role}
        label={label}
      />
      {resetTarget && (
        <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </section>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  role,
  label,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  role: UserRole;
  label: string;
}) {
  const create = useCreateUser();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  function reset() {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setError(null);
    setCreatedPassword(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await create.mutateAsync({
        email,
        firstName,
        lastName,
        phone: phone || undefined,
        role,
      });
      setCreatedPassword(res.initialPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (create.isPending) return;
        onOpenChange(o);
        if (!o) reset();
      }}
      title={createdPassword ? `${label} created` : `Add ${label.toLowerCase()}`}
    >
      {createdPassword ? (
        <div className="space-y-4">
          <p className="text-sm">
            Initial password for <strong>{email}</strong>:
          </p>
          <code className="block rounded-md bg-muted p-3 font-mono">{createdPassword}</code>
          <p className="text-xs text-muted-foreground">
            Save this now — it won't be shown again. Hand it to the {label.toLowerCase()} so they
            can log in and change it.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Email</span>
            <Input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">First name</span>
              <Input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Last name</span>
              <Input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Phone (optional)</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function ResetPasswordDialog({
  target,
  onClose,
}: {
  target: { id: string; email: string };
  onClose: () => void;
}) {
  const reset = useResetPassword();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await reset.mutateAsync({
        id: target.id,
        newPassword: newPassword || undefined,
      });
      setResult(res.newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !reset.isPending) onClose();
      }}
      title={result ? 'Password reset' : 'Reset password'}
      description={result ? undefined : `For ${target.email}`}
    >
      {result ? (
        <div className="space-y-4">
          <p className="text-sm">New password:</p>
          <code className="block rounded-md bg-muted p-3 font-mono">{result}</code>
          <p className="text-xs text-muted-foreground">
            Save this now. The user's existing sessions have been revoked.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">New password (optional)</span>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to auto-generate"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={reset.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={reset.isPending}>
              {reset.isPending ? 'Resetting…' : 'Reset'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
