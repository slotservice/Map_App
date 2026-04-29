'use client';

import { useAuthStore } from '@/lib/auth';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  return (
    <section className="max-w-md space-y-3">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Name</dt>
        <dd>{user.firstName} {user.lastName}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-muted-foreground">Phone</dt>
        <dd>{user.phone ?? '—'}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd className="capitalize">{user.role}</dd>
      </dl>
      <p className="pt-4 text-sm text-muted-foreground">
        TODO(week-1): editable form + change-password subsection.
      </p>
    </section>
  );
}
