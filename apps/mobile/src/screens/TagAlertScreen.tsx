import { Text, View, StyleSheet } from 'react-native';
export function TagAlertScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Tag Alert</Text>
      <Text style={styles.todo}>
        TODO(week-3): title + description + up to 8 photos. Submit triggers a
        per-map email alert via the API outbox.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700' },
  todo: { fontSize: 12, color: '#6b7280', marginTop: 12 },
});
