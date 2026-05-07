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
  icon: React.ReactNode;
  roles: UserRole[];
}

interface NavSection {
  header: string;
  items: NavItem[];
  roles?: UserRole[]; // if set, only show section to these roles
}

const SECTIONS: NavSection[] = [
  {
    header: 'Maps',
    items: [
      {
        href: '/maps',
        label: 'Map list',
        icon: <MapIcon />,
        roles: [UserRole.ADMIN, UserRole.VENDOR, UserRole.VIEWER],
      },
    ],
  },
  {
    header: 'Users',
    roles: [UserRole.ADMIN],
    items: [
      { href: '/workers', label: 'Worker list', icon: <UsersIcon />, roles: [UserRole.ADMIN] },
      { href: '/vendors', label: 'Vendor list', icon: <BriefcaseIcon />, roles: [UserRole.ADMIN] },
      { href: '/viewers', label: 'Viewer list', icon: <EyeIcon />, roles: [UserRole.ADMIN] },
      { href: '/audit-log', label: 'Audit log', icon: <ListIcon />, roles: [UserRole.ADMIN] },
    ],
  },
  {
    header: 'Account Settings',
    items: [
      {
        href: '/profile',
        label: 'Profile',
        icon: <UserIcon />,
        roles: [UserRole.ADMIN, UserRole.VENDOR, UserRole.VIEWER],
      },
      {
        href: '/change-password',
        label: 'Change Password',
        icon: <LockIcon />,
        roles: [UserRole.ADMIN, UserRole.VENDOR, UserRole.VIEWER],
      },
    ],
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

  const sections = SECTIONS.filter(
    (s) => !s.roles || (s.roles as UserRole[]).includes(user.role),
  ).map((s) => ({
    ...s,
    items: s.items.filter((i) => (i.roles as UserRole[]).includes(user.role)),
  }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r bg-muted p-4">
        <div className="mb-6">
          <h2 className="text-lg font-bold">Full Circle FM</h2>
          <p className="text-xs text-muted-foreground">
            {user.email} <span className="capitalize">· {user.role}</span>
          </p>
        </div>

        <nav className="space-y-4">
          {sections.map((section) => (
            <div key={section.header}>
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.header}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                        active
                          ? 'bg-brand text-brand-foreground'
                          : 'hover:bg-background'
                      }`}
                    >
                      <span aria-hidden="true" className="text-current">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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

// Inline icon set — small, hand-rolled SVGs to avoid pulling another
// dep. Each is 16×16 and inherits currentColor.
const ICON = 'h-4 w-4';

function MapIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 11a4 4 0 100-8 4 4 0 000 8z" />
      <path d="M8 11a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M2 21v-2a4 4 0 014-4h2" />
      <path d="M12 21v-2a4 4 0 014-4h2a4 4 0 014 4v2" />
    </svg>
  );
}
function BriefcaseIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}
