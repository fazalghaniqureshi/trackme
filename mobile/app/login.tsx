import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../services/authService';
import { setCredentials } from '../services/traccarService';

export default function LoginScreen() {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState(process.env.EXPO_PUBLIC_TRACCAR_URL ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!serverUrl.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { role } = await login(serverUrl.trim(), email.trim(), password);
      setCredentials({ serverUrl: serverUrl.trim(), email: email.trim(), password });
      if (role === 'admin' || role === 'fleet_manager') {
        router.replace('/(manager)/map');
      } else {
        router.replace('/(driver)/map');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>TrackMe</Text>
        <Text style={styles.subtitle}>Fleet Management</Text>

        {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

        <Text style={styles.label}>SERVER URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://your-traccar-server.com"
          placeholderTextColor="#3d5470"
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor="#3d5470"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#3d5470"
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { color: '#e2eaf6', fontSize: 36, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#7a93b4', fontSize: 14, textAlign: 'center', marginBottom: 40 },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#ef4444', fontSize: 13 },
  label: { color: '#7a93b4', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#162236', borderWidth: 1, borderColor: '#1e3050', borderRadius: 8, padding: 14, color: '#e2eaf6', fontSize: 15, marginBottom: 16 },
  button: { backgroundColor: '#3b82f6', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
