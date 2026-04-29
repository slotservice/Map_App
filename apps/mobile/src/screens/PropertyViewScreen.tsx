import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useStore } from '../lib/queries';
import { COLORS } from '../lib/theme';

interface Props {
  route: RouteProp<RootStackParamList, 'PropertyView'>;
}

export function PropertyViewScreen({ route }: Props) {
  const { storeId } = route.params;
  const { data: store, isLoading } = useStore(storeId);

  if (isLoading || !store) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.storeNumber}>{store.storeNumber}</Text>
      <Text style={styles.storeName}>{store.storeName}</Text>
      {store.address && <Text style={styles.muted}>{store.address}</Text>}

      <View style={styles.imageBox}>
        {store.propertyImageUrl ? (
          <Image
            source={{ uri: store.propertyImageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.muted}>
            No property image uploaded yet. Ask an admin to add one in the backend.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  storeNumber: { color: COLORS.muted, fontSize: 12 },
  storeName: { fontSize: 22, fontWeight: '700' },
  muted: { color: COLORS.muted, marginTop: 8 },
  imageBox: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.bg,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
});
