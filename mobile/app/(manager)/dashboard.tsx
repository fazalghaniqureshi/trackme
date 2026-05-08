import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startOfDay, endOfDay } from 'date-fns';
import { getDevices, getSummary } from '../../services/traccarService';
import StatCard from '../../components/StatCard';
import { metersToKm } from '../../types/traccar';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [totalDevices, setTotalDevices] = useState(0);
  const [online, setOnline] = useState(0);
  const [offline, setOffline] = useState(0);
  const [todayDistance, setTodayDistance] = useState(0);

  const load = async () => {
    const devices = await getDevices();
    setTotalDevices(devices.length);
    setOnline(devices.filter((d) => d.status === 'online').length);
    setOffline(devices.filter((d) => d.status === 'offline').length);
    const now = new Date();
    const summaries = await getSummary(startOfDay(now), endOfDay(now)) as { distance?: number }[];
    setTodayDistance(summaries.reduce((s, r) => s + (r.distance ?? 0), 0));
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
    >
      <Text style={styles.title}>Fleet Dashboard</Text>
      <View style={styles.row}>
        <StatCard label="Total Devices" value={totalDevices} color="#3b82f6" />
        <StatCard label="Online" value={online} color="#22c55e" />
        <StatCard label="Offline" value={offline} color="#ef4444" />
      </View>
      <View style={styles.row}>
        <StatCard label="Today's Distance" value={metersToKm(todayDistance).toFixed(1)} unit="km" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e', padding: 16 },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  row: { flexDirection: 'row', marginBottom: 8 },
});
