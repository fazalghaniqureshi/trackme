import { View, Text, StyleSheet } from 'react-native';

interface Props {
  speedKmh: number;
  limitKmh: number;
}

const SpeedOverlay = ({ speedKmh, limitKmh }: Props) => {
  const speeding = speedKmh > limitKmh;
  return (
    <View style={[styles.container, speeding && styles.speeding]}>
      <Text style={styles.speed}>{Math.round(speedKmh)}</Text>
      <Text style={styles.unit}>km/h</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    backgroundColor: 'rgba(8,15,30,0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e3050',
    padding: 10,
    alignItems: 'center',
    minWidth: 64,
  },
  speeding: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  speed: { color: '#e2eaf6', fontSize: 26, fontWeight: '700', lineHeight: 28 },
  unit: { color: '#7a93b4', fontSize: 11 },
});

export default SpeedOverlay;
