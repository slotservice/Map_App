import { useState } from 'react';
import { Text, TextInput, View, Pressable, StyleSheet } from 'react-native';
import { api } from '../lib/api';

export function ChangePasswordScreen() {
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setMsg(null);
    try {
      await api.post('auth/change-password', { json: { oldPassword, newPassword } });
      setMsg('Password updated.');
      setOld('');
      setNew('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Current password</Text>
      <TextInput style={styles.input} secureTextEntry value={oldPassword} onChangeText={setOld} />
      <Text style={styles.label}>New password</Text>
      <TextInput style={styles.input} secureTextEntry value={newPassword} onChangeText={setNew} />
      {msg && <Text style={styles.msg}>{msg}</Text>}
      <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  label: { color: '#6b7280', marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  msg: { marginVertical: 8 },
  button: {
    backgroundColor: '#ed7332',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
