import { Text, View, StyleSheet, Pressable } from 'react-native';
import { useAuthStore } from '../lib/auth';

export function ProfileScreen() {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Name</Text>
      <Text style={styles.value}>
        {user.firstName} {user.lastName}
      </Text>

      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{user.email}</Text>

      <Text style={styles.label}>Phone</Text>
      <Text style={styles.value}>{user.phone ?? '—'}</Text>

      <Pressable style={styles.button} onPress={() => logout()}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 8 },
  label: { color: '#6b7280', marginTop: 12, fontSize: 12 },
  value: { fontSize: 16 },
  button: {
    marginTop: 32,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
