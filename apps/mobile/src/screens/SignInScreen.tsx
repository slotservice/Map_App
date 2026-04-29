import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../lib/auth';

export function SignInScreen() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Map Store</Text>
      <Text style={styles.subtitle}>Worker sign-in</Text>

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#ed7332' },
  title: { fontSize: 32, fontWeight: '700', color: '#fff', textAlign: 'center' },
  subtitle: { color: '#fff', textAlign: 'center', marginBottom: 24, opacity: 0.9 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#fff', marginBottom: 8, fontWeight: '500' },
});
