'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { friendlyError } from '@/lib/friendly-error';

export default function ChangePasswordPage() {
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPassword !== confirm) {
      setMsg({ kind: 'err', text: 'New password and confirmation do not match.' });
      return;
    }
    setLoading(true);
    try {
      await api.post('auth/change-password', { json: { oldPassword, newPassword } });
      setMsg({ kind: 'ok', text: 'Password updated. All other sessions have been logged out.' });
      setOld('');
      setNew('');
      setConfirm('');
    } catch (err) {
      setMsg({ kind: 'err', text: await friendlyError(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">Change password</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Current password</span>
          <Input type="password" required value={oldPassword} onChange={(e) => setOld(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">New password</span>
          <Input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Confirm new password</span>
          <Input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {msg && (
          <p className={`text-sm ${msg.kind === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {msg.text}
          </p>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </section>
  );
}
