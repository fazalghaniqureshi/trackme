import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { loadCredentials, verifySession } from '../services/authService';
import { setCredentials } from '../services/traccarService';

export default function RootLayout() {
  const router = useRouter();

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
    })();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
