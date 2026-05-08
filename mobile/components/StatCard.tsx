import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  value: string | number;
  color?: string;
  unit?: string;
}

const StatCard = ({ label, value, color, unit }: Props) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, color ? { color } : null]}>
      {value}{unit ? <Text style={styles.unit}> {unit}</Text> : null}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#0f1b2d',
    borderWidth: 1,
    borderColor: '#1e3050',
    borderRadius: 10,
    padding: 12,
    margin: 4,
  },
  label: {
    color: '#7a93b4',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    color: '#e2eaf6',
    fontSize: 22,
    fontWeight: '700',
  },
  unit: {
    fontSize: 13,
    fontWeight: '400',
    color: '#7a93b4',
  },
});

export default StatCard;
