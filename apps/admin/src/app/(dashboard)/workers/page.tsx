'use client';

import { UserRole } from '@map-app/shared';
import { UserList } from '@/components/user-list';

export default function WorkersPage() {
  return <UserList role={UserRole.WORKER} label="Worker" />;
}
