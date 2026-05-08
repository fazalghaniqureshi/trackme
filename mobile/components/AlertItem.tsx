import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

type Severity = 'danger' | 'warning' | 'info';

interface Props {
  severity: Severity;
  title: string;
  detail: string;
  timestamp: string;
  onPress?: () => void;
}

const COLORS: Record<Severity, { bg: string; border: string; text: string }> = {
  danger: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
  warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
  info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
};

const AlertItem = ({ severity, title, detail, timestamp, onPress }: Props) => {
  const c = COLORS[severity];
  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: c.bg, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
      <Text style={styles.time}>{timestamp}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  title: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  detail: { color: '#e2eaf6', fontSize: 13, marginBottom: 2 },
  time: { color: '#7a93b4', fontSize: 11 },
});

export default AlertItem;
