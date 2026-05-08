import { useState } from 'react';
import { getLocationHistory } from '../services/traccarService';
import type { TraccarPosition } from '../types/traccar';
import { knotsToKmh } from '../types/traccar';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  speedKmh: number;
  fixTime: string;
}

export const useMapRoute = () => {
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoute = async (deviceId: number, from: Date, to: Date) => {
    setLoading(true);
    setError(null);
    try {
      const positions = await getLocationHistory(deviceId, from, to);
      setRoute(
        positions.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          speedKmh: knotsToKmh(p.speed),
          fixTime: p.fixTime,
        }))
      );
    } catch {
      setError('Failed to load route');
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => setRoute([]);

  return { route, loading, error, loadRoute, clearRoute };
};
