import { Text, View, StyleSheet } from 'react-native';
export function StoreDetailScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Store detail</Text>
      <Text style={styles.todo}>TODO(week-2): per-store header + tasks + count fields.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700' },
  todo: { fontSize: 12, color: '#6b7280', marginTop: 12 },
});
