import { useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Store } from '@map-app/shared';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useMapStores } from '../lib/queries';
import { MARKER_COLOR_HEX } from '../lib/theme';

interface Props {
  route: RouteProp<RootStackParamList, 'MapView'>;
}

export function MapViewScreen({ route }: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mapId } = route.params;
  const { data: stores, isLoading, error } = useMapStores(mapId);
  const mapRef = useRef<MapView | null>(null);

  const initialRegion = useMemo<Region | undefined>(() => {
    if (!stores || stores.length === 0) return undefined;
    const lats = stores.map((s) => s.latitude);
    const lngs = stores.map((s) => s.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.05, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.05, (maxLng - minLng) * 1.4),
    };
  }, [stores]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error) return <Text style={styles.error}>{(error as Error).message}</Text>;
  if (!stores || stores.length === 0) {
    return (
      <View style={styles.loading}>
        <Text style={styles.muted}>No stores in this map yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>
        {stores.map((s) => (
          <StoreMarker
            key={s.id}
            store={s}
            onPress={() => nav.navigate('StoreDetail', { storeId: s.id })}
          />
        ))}
      </MapView>
    </View>
  );
}

function StoreMarker({ store, onPress }: { store: Store; onPress: () => void }) {
  return (
    <Marker
      coordinate={{ latitude: store.latitude, longitude: store.longitude }}
      onPress={onPress}
    >
      <View style={[styles.markerBubble, { backgroundColor: MARKER_COLOR_HEX[store.markerColor] }]}>
        <Text style={styles.markerLabel}>{store.storeNumber}</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#6b7280' },
  error: { padding: 24, color: '#dc2626' },
  markerBubble: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  markerLabel: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
