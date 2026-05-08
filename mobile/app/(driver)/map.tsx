import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { UrlTile } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFleetPolling } from '../../hooks/useFleetPolling';
import VehicleMarker from '../../components/VehicleMarker';
import SpeedOverlay from '../../components/SpeedOverlay';

export default function DriverMapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { devices } = useFleetPolling();
  const [speedLimit, setSpeedLimit] = useState(120);

  useEffect(() => {
    AsyncStorage.getItem('trackme_speed_limit').then((sl) => {
      if (sl) setSpeedLimit(parseInt(sl, 10));
    });
  }, []);

  const primaryDevice = devices[0];

  const initialRegion = primaryDevice
    ? { latitude: primaryDevice.coords.latitude, longitude: primaryDevice.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 30.3753, longitude: 69.3451, latitudeDelta: 8, longitudeDelta: 8 };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <MapView ref={mapRef} style={styles.map} mapType="none" initialRegion={initialRegion}>
        <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
        {devices.map((device) => (
          <VehicleMarker
            key={device.id}
            coordinate={device.coords}
            rotation={device.angle}
            selected
            speeding={device.speedKmh > speedLimit}
          />
        ))}
      </MapView>
      {primaryDevice && (
        <SpeedOverlay speedKmh={primaryDevice.speedKmh} limitKmh={speedLimit} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  map: { flex: 1 },
});
