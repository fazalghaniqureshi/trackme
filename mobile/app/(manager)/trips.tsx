import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { getDevices, getTrips } from '../../services/traccarService';
import { useMapRoute } from '../../hooks/useMapRoute';
import TripRow from '../../components/TripRow';
import type { TraccarTrip } from '../../types/traccar';

type Preset = 'today' | 'week' | 'month';

const getRange = (p: Preset) => {
  const now = new Date();
  if (p === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (p === 'week') return { from: subDays(now, 7), to: now };
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
};

export default function ManagerTripsScreen() {
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<Preset>('today');
  const [trips, setTrips] = useState<TraccarTrip[]>([]);
  const [replayTrip, setReplayTrip] = useState<TraccarTrip | null>(null);
  const { route, loadRoute, clearRoute } = useMapRoute();

  useEffect(() => {
    (async () => {
      const devices = await getDevices();
      const { from, to } = getRange(preset);
      const all: TraccarTrip[] = [];
      for (const d of devices) {
        const t = await getTrips(d.id, from, to);
        all.push(...t.map((tr) => ({ ...tr, deviceName: d.name })));
      }
      setTrips(all.sort((a, b) => b.startTime.localeCompare(a.startTime)));
    })();
  }, [preset]);

  const openReplay = async (trip: TraccarTrip) => {
    setReplayTrip(trip);
    await loadRoute(trip.deviceId, new Date(trip.startTime), new Date(trip.endTime));
  };

  const closeReplay = () => { setReplayTrip(null); clearRoute(); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Trip History</Text>

      <View style={styles.presets}>
        {(['today', 'week', 'month'] as Preset[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.presetBtn, preset === p && styles.presetBtnActive]}
            onPress={() => setPreset(p)}
          >
            <Text style={[styles.presetTxt, preset === p && styles.presetTxtActive]}>
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={trips}
        keyExtractor={(t) => `${t.deviceId}-${t.startTime}`}
        ListEmptyComponent={<Text style={styles.empty}>No trips for this period</Text>}
        renderItem={({ item }) => (
          <TripRow trip={item} onPress={() => openReplay(item)} />
        )}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
      />

      <Modal visible={!!replayTrip} animationType="slide" onRequestClose={closeReplay}>
        <View style={{ flex: 1, backgroundColor: '#080f1e' }}>
          <TouchableOpacity style={styles.closeBtn} onPress={closeReplay}>
            <Text style={styles.closeTxt}>✕ Close</Text>
          </TouchableOpacity>
          {replayTrip && route.length > 0 && (
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude: replayTrip.startLat,
                longitude: replayTrip.startLon,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              <Polyline
                coordinates={route.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
                strokeColor="#3b82f6"
                strokeWidth={3}
              />
              <Marker coordinate={{ latitude: replayTrip.startLat, longitude: replayTrip.startLon }} pinColor="green" title="Start" />
              <Marker coordinate={{ latitude: replayTrip.endLat, longitude: replayTrip.endLon }} pinColor="red" title="End" />
            </MapView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 8 },
  presets: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  presetBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#1e3050' },
  presetBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  presetTxt: { color: '#7a93b4', fontSize: 13 },
  presetTxtActive: { color: '#fff', fontWeight: '600' },
  empty: { color: '#7a93b4', textAlign: 'center', marginTop: 40 },
  closeBtn: { padding: 16 },
  closeTxt: { color: '#3b82f6', fontSize: 16 },
});
