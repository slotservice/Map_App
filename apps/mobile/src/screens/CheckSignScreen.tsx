import { Text, View, StyleSheet } from 'react-native';
export function CheckSignScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Check and Verification</Text>
      <Text style={styles.todo}>
        TODO(week-2): First/Last name + general comments (these flow into the
        Excel export, fixing legacy bug L2) + signature canvas + Complete.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700' },
  todo: { fontSize: 12, color: '#6b7280', marginTop: 12 },
});
