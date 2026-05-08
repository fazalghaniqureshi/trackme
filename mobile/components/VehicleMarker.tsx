import { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';

const blueIcon = require('../assets/icon_blue.png');
const grayIcon = require('../assets/icon_gray.png');

interface Props {
  coordinate: { latitude: number; longitude: number };
  rotation: number;
  selected?: boolean;
  speeding?: boolean;
  onPress?: () => void;
}

const SpeedingDot = () => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.speedingDot, { opacity }]} />
  );
};

const VehicleMarker = ({ coordinate, rotation, selected = false, speeding = false, onPress }: Props) => (
  <Marker
    coordinate={coordinate}
    rotation={rotation}
    anchor={{ x: 0.5, y: 0.5 }}
    onPress={onPress}
    tracksViewChanges={speeding}
  >
    <View style={styles.markerContainer}>
      <Image
        source={selected ? blueIcon : grayIcon}
        style={styles.carIcon}
        resizeMode="contain"
      />
      {speeding && <SpeedingDot />}
    </View>
  </Marker>
);

const styles = StyleSheet.create({
  markerContainer: { width: 40, height: 40 },
  carIcon: { width: 40, height: 40 },
  speedingDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default VehicleMarker;
