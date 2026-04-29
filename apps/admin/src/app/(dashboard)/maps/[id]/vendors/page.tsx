'use client';

import { useParams } from 'next/navigation';
import { UserRole } from '@map-app/shared';
import { MapAssignmentList } from '@/components/map-assignment-list';

export default function MapVendorsPage() {
  const { id } = useParams<{ id: string }>();
  return <MapAssignmentList mapId={id} role={UserRole.VENDOR} label="Vendor" />;
}
