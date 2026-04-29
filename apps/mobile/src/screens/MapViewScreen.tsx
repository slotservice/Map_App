import { Text, View, StyleSheet } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';

interface Props {
  route: RouteProp<RootStackParamList, 'MapView'>;
}

export function MapViewScreen({ route }: Props) {
  // TODO(week-2): render <MapView/> with markers + colour state machine.
  // Until then, show the map id so we can verify navigation wiring.
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Map view</Text>
      <Text style={styles.body}>Map id: {route.params.mapId}</Text>
      <Text style={styles.todo}>
        TODO(week-2): Google Maps + per-store markers + colour state machine
        (Appendix E in REBUILD_PLAN).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 14 },
  todo: { fontSize: 12, color: '#6b7280', marginTop: 12 },
});
