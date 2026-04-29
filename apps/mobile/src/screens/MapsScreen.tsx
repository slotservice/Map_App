import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MapSummary } from '@map-app/shared';
import { api } from '../lib/api';
import type { RootStackParamList } from '../navigation/RootNavigator';

export function MapsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['maps'],
    queryFn: () => api.get('maps').json<MapSummary[]>(),
  });

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (error) return <Text style={styles.error}>{(error as Error).message}</Text>;

  return (
    <View style={styles.root}>
      <Text style={styles.header}>Total {data?.length ?? 0} Maps</Text>
      <FlatList
        data={data}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => nav.navigate('MapView', { mapId: item.id })}
          >
            <Text style={styles.rowText}>{item.name}</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 16, fontWeight: '700', backgroundColor: '#fff' },
  row: { paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#fff' },
  rowText: { fontSize: 16 },
  sep: { height: 1, backgroundColor: '#e5e7eb' },
  error: { padding: 24, color: '#dc2626' },
});
