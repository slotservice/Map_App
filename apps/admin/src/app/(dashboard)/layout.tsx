'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserRole } from '@map-app/shared';
import { useAuthStore } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

interface NavItem {
  href: Route;
  label: string;
  roles: UserRole[];
}

const ALL_NAV: NavItem[] = [
  { href: '/maps', label: 'Maps', roles: [UserRole.ADMIN, UserRole.VENDOR, UserRole.VIEWER] },
  { href: '/workers', label: 'Workers', roles: [UserRole.ADMIN] },
  { href: '/vendors', label: 'Vendors', roles: [UserRole.ADMIN] },
  { href: '/viewers', label: 'Viewers', roles: [UserRole.ADMIN] },
  { href: '/audit-log', label: 'Audit log', roles: [UserRole.ADMIN] },
  { href: '/profile', label: 'Profile', roles: [UserRole.ADMIN, UserRole.VENDOR, UserRole.VIEWER] },
  {
    href: '/change-password',
    label: 'Change password',
    roles: [UserRole.ADMIN, UserRole.VENDOR, UserRole.VIEWER],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hydrated, hydrate, logout } = useAuthStore();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (hydrated && !user) router.replace('/login');
  }, [hydrated, user, router]);

  if (!hydrated || !user) return null;

  const nav = ALL_NAV.filter((n) => (n.roles as UserRole[]).includes(user.role));

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r bg-muted p-4">
        <div className="mb-6">
          <h2 className="text-lg font-bold">Full Circle FM</h2>
          <p className="text-xs text-muted-foreground">
            {user.email} <span className="capitalize">· {user.role}</span>
          </p>
        </div>
        <nav className="space-y-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active ? 'bg-brand text-brand-foreground' : 'hover:bg-background'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 space-y-2">
          <button
            onClick={toggle}
            type="button"
            className="w-full rounded-md border px-3 py-2 text-sm hover:bg-background"
          >
            {theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode'}
          </button>
          <button
            onClick={() => logout().then(() => router.replace('/login'))}
            className="w-full rounded-md border px-3 py-2 text-sm hover:bg-background"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
