'use client';

import { UserRole } from '@map-app/shared';
import { UserList } from '@/components/user-list';

export default function ViewersPage() {
  return <UserList role={UserRole.VIEWER} label="Viewer" />;
}
