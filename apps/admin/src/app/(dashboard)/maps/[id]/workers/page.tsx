'use client';

import { useParams } from 'next/navigation';
import { UserRole } from '@map-app/shared';
import { MapAssignmentList } from '@/components/map-assignment-list';

export default function MapWorkersPage() {
  const { id } = useParams<{ id: string }>();
  return <MapAssignmentList mapId={id} role={UserRole.WORKER} label="Worker" />;
}
