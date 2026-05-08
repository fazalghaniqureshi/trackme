import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { loadCredentials, verifySession } from '../services/authService';
import { setCredentials } from '../services/traccarService';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const creds = await loadCredentials();
      if (creds) {
        setCredentials(creds);
        const role = await verifySession(creds);
        if (role === 'admin' || role === 'fleet_manager') {
          router.replace('/(manager)/map');
        } else if (role === 'driver') {
          router.replace('/(driver)/map');
        } else {
          router.replace('/login');
        }
      } else {
        router.replace('/login');
      }
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080f1e' }}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
