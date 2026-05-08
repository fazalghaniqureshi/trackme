import { useState, useEffect, useRef } from 'react';
import { getDevices, getPositions } from '../services/traccarService';
import type { TraccarDevice, TraccarPosition } from '../types/traccar';
import { knotsToKmh } from '../types/traccar';

export interface DeviceWithPosition extends TraccarDevice {
  position?: TraccarPosition;
  speedKmh: number;
  coords: { latitude: number; longitude: number };
  angle: number;
}

export const useFleetPolling = (intervalMs = 5000) => {
  const [devices, setDevices] = useState<DeviceWithPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    try {
      const devs = await getDevices();
      if (devs.length === 0) { setDevices([]); setLoading(false); return; }
      const ids = devs.map((d) => d.id);
      const positions = await getPositions(ids);
      const posMap = new Map(positions.map((p) => [p.deviceId, p]));
      setDevices(
        devs.map((d) => {
          const pos = posMap.get(d.id);
          return {
            ...d,
            position: pos,
            speedKmh: pos ? knotsToKmh(pos.speed) : 0,
            coords: {
              latitude: pos?.latitude ?? 30.3753,
              longitude: pos?.longitude ?? 69.3451,
            },
            angle: pos?.course ?? 0,
          };
        })
      );
      setError(null);
    } catch {
      setError('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return { devices, loading, error, refresh: poll };
};
