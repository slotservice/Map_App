import { Text, View, StyleSheet } from 'react-native';
export function AddPhotosScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Add Photos</Text>
      <Text style={styles.todo}>
        TODO(week-2): Before/After columns + Add More + Save vs Save & Next.
        Save persists current photos, Save & Next moves to Check & Verification.
        This is the fix for legacy bug L3.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700' },
  todo: { fontSize: 12, color: '#6b7280', marginTop: 12 },
});
