import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#080f1e', borderTopColor: '#1e3050' },
        tabBarActiveTintColor: '#8b5cf6',
        tabBarInactiveTintColor: '#7a93b4',
      }}
    >
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} /> }} />
      <Tabs.Screen name="vehicles" options={{ title: 'Vehicles', tabBarIcon: ({ color, size }) => <Ionicons name="car" size={size} color={color} /> }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }} />
      <Tabs.Screen name="log" options={{ title: 'Log', tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }} />
    </Tabs>
  );
}
