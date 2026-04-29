import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CompleteStoreRequest,
  Completion,
  MapSummary,
  Photo,
  PhotoKind,
  PresignUploadRequest,
  PresignUploadResponse,
  Store,
} from '@map-app/shared';
import { api } from './api';

// ---- Maps & stores --------------------------------------------------------

export const useMaps = () =>
  useQuery({
    queryKey: ['maps'],
    queryFn: () => api.get('maps').json<MapSummary[]>(),
  });

export const useMapStores = (mapId: string | undefined) =>
  useQuery({
    queryKey: ['maps', mapId, 'stores'],
    queryFn: () => api.get(`maps/${mapId}/stores`).json<Store[]>(),
    enabled: !!mapId,
  });

export const useStore = (storeId: string | undefined) =>
  useQuery({
    queryKey: ['stores', storeId],
    queryFn: () => api.get(`stores/${storeId}`).json<Store>(),
    enabled: !!storeId,
  });

// ---- Photos ---------------------------------------------------------------

export const useStorePhotos = (storeId: string | undefined, kind?: PhotoKind) =>
  useQuery({
    queryKey: ['stores', storeId, 'photos', kind ?? 'all'],
    queryFn: () =>
      api.get(`stores/${storeId}/photos${kind ? `?kind=${kind}` : ''}`).json<Photo[]>(),
    enabled: !!storeId,
  });

export const usePresignPhotoUpload = (storeId: string) =>
  useMutation({
    mutationFn: async (req: PresignUploadRequest) =>
      api.post(`stores/${storeId}/photos`, { json: req }).json<PresignUploadResponse>(),
  });

export const useFinalizePhoto = () =>
  useMutation({
    mutationFn: async (input: { photoId: string; sha256: string }) => {
      await api.post(`photos/${input.photoId}/finalize`, { json: { sha256: input.sha256 } });
    },
  });

export const useDeletePhoto = (storeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(`photos/${photoId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores', storeId, 'photos'] }),
  });
};

// ---- Completion -----------------------------------------------------------

export const useCompleteStore = (storeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CompleteStoreRequest) =>
      api.post(`stores/${storeId}/complete`, { json: body }).json<Completion>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stores', storeId] });
      qc.invalidateQueries({ queryKey: ['maps'] });
    },
  });
};

export const useStoreCompletion = (storeId: string | undefined) =>
  useQuery({
    queryKey: ['stores', storeId, 'completion'],
    queryFn: () => api.get(`stores/${storeId}/completion`).json<Completion | null>(),
    enabled: !!storeId,
  });

// ---- Tag alerts -----------------------------------------------------------

export const useCreateTagAlert = (storeId: string) =>
  useMutation({
    mutationFn: async (body: { title: string; description: string; photoIds: string[] }) => {
      await api.post(`stores/${storeId}/tag-alerts`, { json: body });
    },
  });
