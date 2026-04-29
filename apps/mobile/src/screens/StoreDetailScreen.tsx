import { useEffect } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Store, MapSummary } from '@map-app/shared';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useMaps, useStore, useStoreCompletion } from '../lib/queries';
import { useDraftStore } from '../lib/completion-draft';
import { COLORS } from '../lib/theme';

interface Props {
  route: RouteProp<RootStackParamList, 'StoreDetail'>;
}

export function StoreDetailScreen({ route }: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { storeId } = route.params;
  const { data: store, isLoading } = useStore(storeId);
  const { data: maps } = useMaps();
  const { data: completion } = useStoreCompletion(storeId);
  const draft = useDraftStore((s) => s.drafts[storeId] ?? { counts: {}, fieldName: '', generalComments: '' });
  const setCount = useDraftStore((s) => s.setCount);

  // Load any saved counts from existing completion (read-back).
  useEffect(() => {
    if (!completion) return;
    for (const [k, v] of Object.entries(completion.counts)) setCount(storeId, k, v);
  }, [completion, storeId, setCount]);

  if (isLoading || !store) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  const map: MapSummary | undefined = maps?.find((m) => m.id === store.mapId);
  const countColumns = map?.countColumns ?? [];
  const completed = !!completion;

  function openDirections() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${store!.latitude},${store!.longitude}`;
    Linking.openURL(url).catch(() => {});
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.storeNumber}>{store.storeNumber}</Text>
          <Text style={styles.storeName}>{store.storeName}</Text>
        </View>
        <Pressable
          onPress={() => nav.goBack()}
          hitSlop={20}
          accessibilityLabel="Close"
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <Field label="State" value={store.state} />
      <Field label="Address" value={store.address} />
      <Field label="Zip" value={store.zip} />
      <Field label="Latitude" value={String(store.latitude)} />
      <Field label="Longitude" value={String(store.longitude)} />
      <Field label="Type" value={store.type} />
      <Field label="Manager" value={store.manager} />

      {store.tasks.length > 0 && <View style={styles.divider} />}
      {store.tasks.map((t) => (
        <Field
          key={t.name}
          label={t.name.replace(/_/g, ' ')}
          value={t.currentStatus.replace(/_/g, ' ')}
        />
      ))}

      {countColumns.length > 0 && <View style={styles.divider} />}
      {countColumns.map((c) => (
        <View key={c} style={styles.row}>
          <Text style={styles.label}>{c.replace(/_/g, ' ')}</Text>
          <TextInput
            value={String(draft.counts[c] ?? '')}
            onChangeText={(t) => {
              const num = Number(t.replace(/[^0-9]/g, ''));
              setCount(storeId, c, Number.isFinite(num) ? num : 0);
            }}
            keyboardType="number-pad"
            editable={!completed}
            style={[styles.countInput, completed && styles.disabled]}
            placeholder="0"
          />
        </View>
      ))}

      <View style={styles.actionsRow}>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={openDirections}>
          <Text style={styles.secondaryText}>Get directions</Text>
        </Pressable>
        {!completed ? (
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={() => nav.navigate('AddPhotos', { storeId })}
          >
            <Text style={styles.primaryText}>Continue</Text>
          </Pressable>
        ) : (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>Completed</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  storeNumber: { color: COLORS.muted, fontSize: 12 },
  storeName: { fontSize: 22, fontWeight: '700' },
  close: { fontSize: 22, color: COLORS.muted, paddingHorizontal: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  label: { color: COLORS.muted, flex: 1 },
  value: { flex: 1, textAlign: 'right' },
  divider: { height: 12 },
  countInput: {
    width: 80,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    textAlign: 'right',
  },
  disabled: { backgroundColor: COLORS.bg, color: COLORS.muted },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: { backgroundColor: COLORS.brand },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  secondaryText: { color: COLORS.text, fontWeight: '600' },
  completedBadge: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#dcfce7',
  },
  completedText: { color: '#166534', fontWeight: '600' },
});
