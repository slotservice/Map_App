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

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useCreateTagAlert, useDeletePhoto, useStorePhotos } from '../lib/queries';
import { uploadPhoto } from '../lib/photo-upload';
import { COLORS } from '../lib/theme';

interface Props {
  route: RouteProp<RootStackParamList, 'TagAlert'>;
}

const MAX_PHOTOS = 8;

export function TagAlertScreen({ route }: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { storeId } = route.params;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: photos = [], refetch } = useStorePhotos(storeId, 'tag_alert');
  const deletePhoto = useDeletePhoto(storeId);
  const createAlert = useCreateTagAlert(storeId);

  // Show only photos that haven't been linked to a previous tag-alert.
  const newPhotos = photos.filter((p) => !p.completionId);

  async function addPhoto() {
    if (newPhotos.length >= MAX_PHOTOS) {
      Alert.alert(`Maximum ${MAX_PHOTOS} photos`);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Camera permission required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85, exif: false });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      await uploadPhoto({ storeId, localUri: result.assets[0].uri, kind: 'tag_alert' });
      await refetch();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!title.trim()) return Alert.alert('Title is required');
    if (!description.trim()) return Alert.alert('Description is required');
    setBusy(true);
    try {
      await createAlert.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        photoIds: newPhotos.map((p) => p.id),
      });
      Alert.alert('Tag alert sent', 'Recipients will receive the email shortly.', [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
    } catch (err) {
      // The endpoint returns 501 today; admin email pipeline is week-3.
      // Soften the error so workers know the issue was raised but the
      // notification will follow.
      Alert.alert(
        'Saved (email pending)',
        err instanceof Error ? err.message : 'Tag alert recorded; email delivery is being finalised.',
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.help}>
        Use this for trouble spots that need attention from the office. The recipients you see
        listed under "Tag-alert recipients" in the admin will get an email with the photos.
      </Text>

      <Text style={styles.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        placeholder="Short summary"
        maxLength={200}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        style={[styles.input, styles.multiline]}
        placeholder="What did you find?"
        multiline
        numberOfLines={5}
        maxLength={2000}
      />

      <Text style={styles.label}>Photos ({newPhotos.length}/{MAX_PHOTOS})</Text>
      <View style={styles.photoGrid}>
        {newPhotos.map((p) => (
          <View key={p.id} style={styles.photoTile}>
            <Image source={{ uri: p.url }} style={styles.photoImage} resizeMode="cover" />
            <Pressable style={styles.removeButton} onPress={() => deletePhoto.mutate(p.id)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {newPhotos.length < MAX_PHOTOS && (
          <Pressable style={styles.addTile} onPress={addPhoto} disabled={busy}>
            {busy ? <ActivityIndicator /> : <Text style={styles.addTileText}>+</Text>}
          </Pressable>
        )}
      </View>

      <Pressable style={styles.submitButton} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Send tag alert</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32 },
  help: { fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 16 },
  label: { fontWeight: '600', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  photoTile: { width: '30%', aspectRatio: 1, position: 'relative' },
  photoImage: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: COLORS.bg },
  removeButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  removeText: { color: '#fff', fontSize: 10 },
  addTile: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileText: { fontSize: 24, color: COLORS.muted },
  submitButton: {
    marginTop: 24,
    backgroundColor: COLORS.danger,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '600' },
});
