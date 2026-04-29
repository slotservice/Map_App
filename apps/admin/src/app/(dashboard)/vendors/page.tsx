'use client';

import { UserRole } from '@map-app/shared';
import { UserList } from '@/components/user-list';

export default function VendorsPage() {
  return <UserList role={UserRole.VENDOR} label="Vendor" />;
}
