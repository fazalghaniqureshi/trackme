import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadCredentials, clearCredentials } from '../../services/authService';

export default function ManagerSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState('');
  const [email, setEmail] = useState('');
  const [speedLimit, setSpeedLimit] = useState('120');

  useEffect(() => {
    (async () => {
      const creds = await loadCredentials();
      if (creds) { setServerUrl(creds.serverUrl); setEmail(creds.email); }
      const sl = await AsyncStorage.getItem('trackme_speed_limit');
      if (sl) setSpeedLimit(sl);
    })();
  }, []);

  const saveSpeedLimit = async () => {
    await AsyncStorage.setItem('trackme_speed_limit', speedLimit);
  };

  const handleDisconnect = async () => {
    await clearCredentials();
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.row}><Text style={styles.key}>Server</Text><Text style={styles.value}>{serverUrl}</Text></View>
        <View style={styles.row}><Text style={styles.key}>Email</Text><Text style={styles.value}>{email}</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SPEED LIMIT (km/h)</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={speedLimit}
            onChangeText={setSpeedLimit}
            keyboardType="numeric"
            onEndEditing={saveSpeedLimit}
          />
          <Text style={styles.inputUnit}>km/h</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
        <Text style={styles.disconnectTxt}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e', padding: 16 },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  section: { backgroundColor: '#0f1b2d', borderWidth: 1, borderColor: '#1e3050', borderRadius: 10, padding: 16, marginBottom: 16 },
  sectionLabel: { color: '#7a93b4', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#162236' },
  key: { color: '#7a93b4', fontSize: 14 },
  value: { color: '#e2eaf6', fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: '#162236', borderWidth: 1, borderColor: '#1e3050', borderRadius: 8, padding: 10, color: '#e2eaf6', fontSize: 16, width: 80, textAlign: 'center' },
  inputUnit: { color: '#7a93b4', fontSize: 14 },
  disconnectBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  disconnectTxt: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
