import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Completion,
  Map as MapDto,
  MapSummary,
  Photo,
  PhotoKind,
  Store,
  TagAlert,
  User,
  UserRole,
} from '@map-app/shared';
import { api } from './api';

// ---- Maps ----

export const useMaps = () =>
  useQuery({
    queryKey: ['maps'],
    queryFn: () => api.get('maps').json<MapSummary[]>(),
  });

export const useMap = (id: string) =>
  useQuery({
    queryKey: ['maps', id],
    queryFn: () => api.get(`maps/${id}`).json<MapDto>(),
    enabled: !!id,
  });

export const useMapStores = (mapId: string) =>
  useQuery({
    queryKey: ['maps', mapId, 'stores'],
    queryFn: () => api.get(`maps/${mapId}/stores`).json<Store[]>(),
    enabled: !!mapId,
  });

export const useImportMap = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; file: File }) => {
      const formData = new FormData();
      formData.append('name', input.name);
      formData.append('file', input.file);
      return api
        .post('maps/import', { body: formData, timeout: 60_000 })
        .json<{ mapId: string; storeCount: number; taskColumns: string[]; countColumns: string[] }>();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maps'] }),
  });
};

export const useDeleteMap = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`maps/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maps'] }),
  });
};

// ---- Users ----

export const useUsers = (role: UserRole) =>
  useQuery({
    queryKey: ['users', role],
    queryFn: () => api.get(`users?role=${role}`).json<User[]>(),
  });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      role: UserRole;
      initialPassword?: string;
    }) =>
      api
        .post('users', { json: input })
        .json<{ user: User; initialPassword: string }>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useResetPassword = () =>
  useMutation({
    mutationFn: async (input: { id: string; newPassword?: string }) =>
      api
        .post(`users/${input.id}/reset-password`, { json: { newPassword: input.newPassword } })
        .json<{ newPassword: string }>(),
  });

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status?: 'active' | 'blocked' }) =>
      api.patch(`users/${input.id}`, { json: { status: input.status } }).json<User>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`users/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

// ---- Map assignments ----

export interface MapAssignmentRow {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export const useMapAssignments = (mapId: string, role?: UserRole) =>
  useQuery({
    queryKey: ['maps', mapId, 'assignments', role ?? 'all'],
    queryFn: () =>
      api
        .get(`maps/${mapId}/assignments${role ? `?role=${role}` : ''}`)
        .json<MapAssignmentRow[]>(),
    enabled: !!mapId,
  });

export const useAssignMap = (mapId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; role: UserRole }) => {
      await api.post(`maps/${mapId}/assignments`, { json: input });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maps', mapId, 'assignments'] }),
  });
};

export const useUnassignMap = (mapId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`maps/${mapId}/assignments/${userId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maps', mapId, 'assignments'] }),
  });
};

// ---- Stores / completions / photos ----

export const useStore = (storeId: string | undefined) =>
  useQuery({
    queryKey: ['stores', storeId],
    queryFn: () => api.get(`stores/${storeId}`).json<Store>(),
    enabled: !!storeId,
  });

export const useStoreCompletion = (storeId: string | undefined) =>
  useQuery({
    queryKey: ['stores', storeId, 'completion'],
    queryFn: () => api.get(`stores/${storeId}/completion`).json<Completion | null>(),
    enabled: !!storeId,
  });

export const useStorePhotos = (storeId: string | undefined, kind?: PhotoKind) =>
  useQuery({
    queryKey: ['stores', storeId, 'photos', kind ?? 'all'],
    queryFn: () =>
      api.get(`stores/${storeId}/photos${kind ? `?kind=${kind}` : ''}`).json<Photo[]>(),
    enabled: !!storeId,
  });

// ---- Tag alerts ----

export const useMapTagAlerts = (mapId: string | undefined) =>
  useQuery({
    queryKey: ['maps', mapId, 'tag-alerts'],
    queryFn: () => api.get(`maps/${mapId}/tag-alerts`).json<TagAlert[]>(),
    enabled: !!mapId,
  });
