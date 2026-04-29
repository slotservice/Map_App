import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Photo } from '@map-app/shared';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useDeletePhoto, useStore, useStorePhotos } from '../lib/queries';
import { uploadPhoto } from '../lib/photo-upload';
import { useDraftStore } from '../lib/completion-draft';
import { COLORS } from '../lib/theme';

interface Props {
  route: RouteProp<RootStackParamList, 'AddPhotos'>;
}

export function AddPhotosScreen({ route }: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { storeId } = route.params;
  const { data: store } = useStore(storeId);
  const { data: photos = [], refetch, isLoading } = useStorePhotos(storeId);
  const deletePhoto = useDeletePhoto(storeId);
  const fieldName = useDraftStore((s) => s.drafts[storeId]?.fieldName ?? '');
  const setFieldName = useDraftStore((s) => s.setFieldName);
  const [busyKind, setBusyKind] = useState<'before' | 'after' | null>(null);

  const before = photos.filter((p) => p.kind === 'before' && !p.completionId);
  const after = photos.filter((p) => p.kind === 'after' && !p.completionId);

  async function pickAndUpload(kind: 'before' | 'after') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Camera permission required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;

    setBusyKind(kind);
    try {
      await uploadPhoto({
        storeId,
        localUri: result.assets[0].uri,
        kind,
        fieldName: fieldName || undefined,
      });
      await refetch();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusyKind(null);
    }
  }

  async function pickFromGallery(kind: 'before' | 'after') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Photo library permission required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;

    setBusyKind(kind);
    try {
      await uploadPhoto({
        storeId,
        localUri: result.assets[0].uri,
        kind,
        fieldName: fieldName || undefined,
      });
      await refetch();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusyKind(null);
    }
  }

  function addPhoto(kind: 'before' | 'after') {
    Alert.alert('Add photo', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: () => pickAndUpload(kind) },
      { text: 'Pick from gallery', onPress: () => pickFromGallery(kind) },
    ]);
  }

  if (isLoading || !store) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={styles.actionsLinks}>
        <Pressable onPress={() => nav.navigate('TagAlert', { storeId })}>
          <Text style={styles.link}>Tag Alert</Text>
        </Pressable>
        <Pressable onPress={() => Alert.alert('Property View', 'Coming in Phase 2.')}>
          <Text style={styles.link}>Property View</Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Store ID</Text>
        <Text style={styles.fieldValue}>{store.storeNumber}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Store Name</Text>
        <Text style={styles.fieldValue}>{store.storeName}</Text>
      </View>

      <TextInput
        value={fieldName}
        onChangeText={(t) => setFieldName(storeId, t)}
        placeholder="Field name (e.g. Crash, Canopy)"
        style={styles.input}
      />

      <View style={styles.columns}>
        <Column
          label="Before"
          photos={before}
          busy={busyKind === 'before'}
          onAdd={() => addPhoto('before')}
          onRemove={(id) => deletePhoto.mutate(id)}
        />
        <Column
          label="After"
          photos={after}
          busy={busyKind === 'after'}
          onAdd={() => addPhoto('after')}
          onRemove={(id) => deletePhoto.mutate(id)}
        />
      </View>

      <View style={styles.bottomActions}>
        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={() => nav.navigate('Main')}
        >
          <Text style={styles.secondaryText}>Save</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => nav.navigate('CheckSign', { storeId })}
        >
          <Text style={styles.primaryText}>Save &amp; Next</Text>
        </Pressable>
      </View>

      <Text style={styles.helper}>
        Photos are saved to the server as soon as you take them. Use{' '}
        <Text style={styles.bold}>Save</Text> to keep this work-in-progress and finish later;{' '}
        <Text style={styles.bold}>Save &amp; Next</Text> moves to the signature screen to complete
        the store.
      </Text>
    </ScrollView>
  );
}

function Column({
  label,
  photos,
  busy,
  onAdd,
  onRemove,
}: {
  label: string;
  photos: Photo[];
  busy: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      {photos.map((p) => (
        <View key={p.id} style={styles.photoTile}>
          <Image source={{ uri: p.url }} style={styles.photoImage} resizeMode="cover" />
          <Pressable style={styles.removeButton} onPress={() => onRemove(p.id)}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addTile} onPress={onAdd} disabled={busy}>
        {busy ? <ActivityIndicator /> : <Text style={styles.addTileText}>+ Tap to add</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionsLinks: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginBottom: 12,
  },
  link: { color: COLORS.muted, textDecorationLine: 'underline' },
  field: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: COLORS.muted },
  fieldValue: { fontWeight: '500' },
  input: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  columns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  column: { flex: 1, gap: 8 },
  columnLabel: { fontWeight: '600', marginBottom: 4 },
  photoTile: { position: 'relative' },
  photoImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  removeText: { color: '#fff', fontSize: 11 },
  addTile: {
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileText: { color: COLORS.muted },
  bottomActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  primaryButton: { backgroundColor: COLORS.brand },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  secondaryText: { color: COLORS.text, fontWeight: '600' },
  helper: { marginTop: 12, fontSize: 11, color: COLORS.muted, lineHeight: 16 },
  bold: { fontWeight: '600' },
});
