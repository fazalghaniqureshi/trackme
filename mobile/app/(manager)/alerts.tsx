import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subDays } from 'date-fns';
import { getDevices, getEvents } from '../../services/traccarService';
import AlertItem from '../../components/AlertItem';

interface Alert {
  id: string;
  severity: 'danger' | 'warning' | 'info';
  title: string;
  detail: string;
  timestamp: string;
}

const EVENT_SEVERITY: Record<string, 'danger' | 'warning' | 'info'> = {
  deviceOverspeed: 'danger',
  geofenceEnter: 'warning',
  geofenceExit: 'warning',
  deviceStopped: 'info',
  deviceMoving: 'info',
};

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const devices = await getDevices();
    const now = new Date();
    const from = subDays(now, 1);
    const all: Alert[] = [];
    for (const device of devices) {
      const events = await getEvents(device.id, from, now);
      for (const evt of events) {
        all.push({
          id: String(evt.id),
          severity: EVENT_SEVERITY[evt.type] ?? 'info',
          title: `${evt.type.replace(/([A-Z])/g, ' $1').trim()} — ${device.name}`,
          detail: `Device: ${device.name}`,
          timestamp: new Date(evt.eventTime).toLocaleTimeString(),
        });
      }
    }
    setAlerts(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 50));
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Alerts</Text>
      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        ListEmptyComponent={<Text style={styles.empty}>No alerts in the last 24 hours</Text>}
        renderItem={({ item }) => (
          <AlertItem severity={item.severity} title={item.title} detail={item.detail} timestamp={item.timestamp} />
        )}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 12 },
  empty: { color: '#7a93b4', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
