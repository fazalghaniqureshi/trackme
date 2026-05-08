import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { metersToKm, knotsToKmh, msDuration } from '../types/traccar';
import type { TraccarTrip } from '../types/traccar';

interface Props {
  trip: TraccarTrip;
  onPress?: () => void;
}

const TripRow = ({ trip, onPress }: Props) => (
  <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.row}>
      <Text style={styles.device}>{trip.deviceName}</Text>
      <Text style={styles.distance}>{metersToKm(trip.distance).toFixed(1)} km</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.time}>
        {format(new Date(trip.startTime), 'dd MMM, HH:mm')} → {format(new Date(trip.endTime), 'HH:mm')}
      </Text>
      <Text style={styles.meta}>{msDuration(trip.duration)} · max {knotsToKmh(trip.maxSpeed).toFixed(0)} km/h</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f1b2d',
    borderWidth: 1,
    borderColor: '#1e3050',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  device: { color: '#e2eaf6', fontSize: 13, fontWeight: '600' },
  distance: { color: '#3b82f6', fontSize: 13, fontWeight: '700' },
  time: { color: '#7a93b4', fontSize: 11 },
  meta: { color: '#7a93b4', fontSize: 11 },
});

export default TripRow;
