'use client';

import { useEffect, useState } from 'react';
import type { AuthUser } from '@map-app/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth';
import { useUpdateProfile } from '@/lib/queries';
import { friendlyError } from '@/lib/friendly-error';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const update = useUpdateProfile();

  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setPhone(user.phone ?? '');
    setAddress(user.address ?? '');
    setState(user.state ?? '');
    setZip(user.zip ?? '');
  }, [user]);

  if (!user) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const updated = await update.mutateAsync({
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
      });
      // Persist back so the cached AuthUser in localStorage stays in sync.
      const next: AuthUser = {
        ...user!,
        phone: updated.phone,
        address: updated.address,
        state: updated.state,
        zip: updated.zip,
      };
      setUser(next);
      setMsg({ kind: 'ok', text: 'Profile saved.' });
    } catch (err) {
      setMsg({ kind: 'err', text: await friendlyError(err) });
    }
  }

  return (
    <section className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">My profile</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <ReadOnly label="Name" value={`${user.firstName} ${user.lastName}`} />
        <ReadOnly label="Email" value={user.email} />
        <ReadOnly label="Role" value={user.role} className="capitalize" />

        <label className="block space-y-1">
          <span className="text-sm font-medium">Phone</span>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Address</span>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={255} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">State</span>
            <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={20} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Zip</span>
            <Input value={zip} onChange={(e) => setZip(e.target.value)} maxLength={20} />
          </label>
        </div>

        {msg && (
          <p className={`text-sm ${msg.kind === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {msg.text}
          </p>
        )}

        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </section>
  );
}

function ReadOnly({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <Input value={value} disabled className={className} />
    </label>
  );
}
