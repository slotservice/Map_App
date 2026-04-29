import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useCompleteStore, useStorePhotos } from '../lib/queries';
import { uploadPhoto } from '../lib/photo-upload';
import { useDraftStore } from '../lib/completion-draft';
import { COLORS } from '../lib/theme';

interface Props {
  route: RouteProp<RootStackParamList, 'CheckSign'>;
}

export function CheckSignScreen({ route }: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { storeId } = route.params;
  const draft = useDraftStore((s) => s.drafts[storeId] ?? { counts: {}, fieldName: '', generalComments: '' });
  const setGeneralComments = useDraftStore((s) => s.setGeneralComments);
  const resetDraft = useDraftStore((s) => s.reset);
  const { data: photos = [] } = useStorePhotos(storeId);
  const complete = useCompleteStore(storeId);
  const sigRef = useRef<SignatureViewRef>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);

  // Photos that haven't been linked to a completion yet are the ones we
  // ship with this submission.
  const beforeIds = photos.filter((p) => p.kind === 'before' && !p.completionId).map((p) => p.id);
  const afterIds = photos.filter((p) => p.kind === 'after' && !p.completionId).map((p) => p.id);

  function handleSignature(base64: string) {
    void submit(base64);
  }

  async function submit(signatureBase64: string) {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('First and last name are required');
      return;
    }

    setBusy(true);
    try {
      // 1. Persist signature PNG to a temp file so we can stream it to S3.
      const stripped = signatureBase64.replace(/^data:image\/png;base64,/, '');
      const tmpUri = `${FileSystem.cacheDirectory}sign-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(tmpUri, stripped, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 2. Upload the signature like any other photo.
      const signaturePhotoId = await uploadPhoto({
        storeId,
        localUri: tmpUri,
        kind: 'signature',
      });

      // 3. Submit the completion.
      await complete.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        signaturePhotoId,
        generalComments: draft.generalComments,
        counts: draft.counts,
        deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        completedAt: new Date().toISOString(),
        beforePhotoIds: beforeIds,
        afterPhotoIds: afterIds,
      });

      resetDraft(storeId);
      Alert.alert('Store completed', 'Marker turns red on the map.', [
        // Pop CheckSign + AddPhotos + StoreDetail → back to MapView
        // so the worker sees the marker turn red.
        { text: 'OK', onPress: () => nav.pop(3) },
      ]);
    } catch (err) {
      Alert.alert('Could not complete', err instanceof Error ? err.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Name of Verification</Text>

      <Text style={styles.label}>First name</Text>
      <TextInput
        value={firstName}
        onChangeText={setFirstName}
        style={styles.input}
        autoCapitalize="words"
      />

      <Text style={styles.label}>Last name</Text>
      <TextInput
        value={lastName}
        onChangeText={setLastName}
        style={styles.input}
        autoCapitalize="words"
      />

      <Text style={styles.label}>Comments</Text>
      <TextInput
        value={draft.generalComments}
        onChangeText={(t) => setGeneralComments(storeId, t)}
        style={[styles.input, styles.multiline]}
        placeholder="Anything to flag for the office?"
        multiline
        numberOfLines={4}
      />
      <Text style={styles.helper}>
        These comments appear on the completed-stores Excel — fixes legacy export bug L2.
      </Text>

      <Text style={styles.label}>Signature</Text>
      <View style={styles.signatureBox}>
        <SignatureScreen
          ref={sigRef}
          onOK={handleSignature}
          webStyle={signatureWebStyle}
          backgroundColor="#ffffff"
          imageType="image/png"
          descriptionText=""
          confirmText="Save"
          clearText="Clear"
          autoClear={false}
        />
      </View>

      <Pressable
        style={styles.completeButton}
        onPress={() => sigRef.current?.readSignature()}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.completeText}>Complete</Text>}
      </Pressable>
    </ScrollView>
  );
}

const signatureWebStyle = `
  .m-signature-pad { box-shadow: none; border: none; }
  .m-signature-pad--body { border: 1px solid #e5e7eb; border-radius: 8px; }
  .m-signature-pad--footer { display: none; }
  body, html { width: 100%; height: 100%; margin: 0; padding: 0; }
`;

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  label: { fontWeight: '600', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  helper: { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  signatureBox: { height: 220, marginTop: 4 },
  completeButton: {
    marginTop: 24,
    backgroundColor: COLORS.brand,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
