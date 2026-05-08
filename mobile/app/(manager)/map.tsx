import { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, FlatList, Pressable } from 'react-native';
import MapView, { UrlTile } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFleetPolling } from '../../hooks/useFleetPolling';
import VehicleMarker from '../../components/VehicleMarker';
import type { DeviceWithPosition } from '../../hooks/useFleetPolling';

const SPEED_LIMIT = 120;

export default function ManagerMapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { devices } = useFleetPolling();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');

  const handleDevicePress = (device: DeviceWithPosition) => {
    setSelectedId(device.id);
    mapRef.current?.animateToRegion({
      latitude: device.coords.latitude,
      longitude: device.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
  };

  const initialRegion = devices[0]
    ? { latitude: devices[0].coords.latitude, longitude: devices[0].coords.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }
    : { latitude: 30.3753, longitude: 69.3451, latitudeDelta: 8, longitudeDelta: 8 };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.mapTypeToggle}>
        {(['standard', 'satellite'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.mapTypeBtn, mapType === t && styles.mapTypeBtnActive]}
            onPress={() => setMapType(t)}
          >
            <Text style={[styles.mapTypeTxt, mapType === t && styles.mapTypeTxtActive]}>
              {t === 'standard' ? 'Street' : 'Satellite'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="none"
        initialRegion={initialRegion}
        showsUserLocation={false}
      >
        <UrlTile
          urlTemplate={mapType === 'satellite'
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
          maximumZ={19}
          flipY={false}
        />
        {devices.map((device) => (
          <VehicleMarker
            key={device.id}
            coordinate={device.coords}
            rotation={device.angle}
            selected={device.id === selectedId}
            speeding={device.speedKmh > SPEED_LIMIT && device.status === 'online'}
            onPress={() => handleDevicePress(device)}
          />
        ))}
      </MapView>

      <View style={styles.deviceList}>
        <FlatList
          data={devices}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={{ paddingHorizontal: 8 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.deviceChip, item.id === selectedId && styles.deviceChipSelected]}
              onPress={() => handleDevicePress(item)}
            >
              <View style={[styles.statusDot, { backgroundColor: item.status === 'online' ? '#22c55e' : '#6b7280' }]} />
              <Text style={styles.deviceName}>{item.name}</Text>
              {item.status === 'online' && (
                <Text style={[styles.deviceSpeed, item.speedKmh > SPEED_LIMIT && styles.speeding]}>
                  {Math.round(item.speedKmh)} km/h
                </Text>
              )}
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  map: { flex: 1 },
  mapTypeToggle: { position: 'absolute', top: 60, right: 12, zIndex: 10, flexDirection: 'row', backgroundColor: '#0f1b2d', borderRadius: 8, borderWidth: 1, borderColor: '#1e3050', overflow: 'hidden' },
  mapTypeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  mapTypeBtnActive: { backgroundColor: '#3b82f6' },
  mapTypeTxt: { color: '#7a93b4', fontSize: 12 },
  mapTypeTxtActive: { color: '#fff', fontWeight: '600' },
  deviceList: { position: 'absolute', bottom: 80, left: 0, right: 0 },
  deviceChip: { backgroundColor: '#0f1b2d', borderWidth: 1, borderColor: '#1e3050', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  deviceChipSelected: { borderColor: '#3b82f6', backgroundColor: '#162236' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  deviceName: { color: '#e2eaf6', fontSize: 12, fontWeight: '600' },
  deviceSpeed: { color: '#7a93b4', fontSize: 11 },
  speeding: { color: '#ef4444', fontWeight: '700' },
});
