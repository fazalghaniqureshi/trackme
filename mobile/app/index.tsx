import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080f1e' }}>
      <ActivityIndicator color="#3b82f6" size="large" />
    </View>
  );
}
