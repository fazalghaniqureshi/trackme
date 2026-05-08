import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFleetPolling } from '../../hooks/useFleetPolling';
import StatCard from '../../components/StatCard';

export default function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const { devices, loading } = useFleetPolling();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>My Vehicles ({devices.length})</Text>
      <FlatList
        data={devices}
        keyExtractor={(d) => String(d.id)}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading…' : 'No vehicles assigned'}</Text>}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftColor: item.status === 'online' ? '#22c55e' : '#6b7280' }]}>
            <View style={styles.cardHeader}>
              <View style={styles.nameRow}>
                <View style={[styles.dot, { backgroundColor: item.status === 'online' ? '#22c55e' : '#6b7280' }]} />
                <Text style={styles.name}>{item.name}</Text>
              </View>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            {item.status === 'online' && (
              <View style={styles.statsRow}>
                <StatCard label="Speed" value={Math.round(item.speedKmh)} unit="km/h" color="#3b82f6" />
                <StatCard label="Heading" value={`${item.angle}°`} />
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 8 },
  empty: { color: '#7a93b4', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#0f1b2d', borderWidth: 1, borderColor: '#1e3050', borderLeftWidth: 3, borderRadius: 10, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: '#e2eaf6', fontSize: 16, fontWeight: '600' },
  status: { color: '#7a93b4', fontSize: 12, textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row' },
});
