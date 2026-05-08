export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'unknown';
  lastUpdate?: string;
  positionId?: number;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;   // KNOTS — multiply by 1.852 for km/h
  course: number;  // heading degrees
  fixTime: string; // ISO
  attributes?: {
    batteryLevel?: number;
    ignition?: boolean;
    motion?: boolean;
    [key: string]: unknown;
  };
}

export interface TraccarTrip {
  deviceId: number;
  deviceName: string;
  startTime: string;
  endTime: string;
  startAddress?: string;
  endAddress?: string;
  distance: number;       // metres
  averageSpeed: number;   // knots
  maxSpeed: number;       // knots
  duration: number;       // milliseconds
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
}

export interface TraccarEvent {
  id: number;
  deviceId: number;
  type: string;
  eventTime: string;
  positionId?: number;
  attributes?: Record<string, unknown>;
}

export interface TraccarGeofence {
  id: number;
  name: string;
  description?: string;
  area: string; // WKT e.g. "CIRCLE (lat lon, radius)"
}

export interface TraccarUser {
  id: number;
  name: string;
  email: string;
  admin: boolean;
  attributes: {
    trackme_role?: 'admin' | 'fleet_manager' | 'driver';
    expo_push_token?: string;
    [key: string]: unknown;
  };
}

export type TrackMeRole = 'admin' | 'fleet_manager' | 'driver';

// Speed conversion helpers
export const knotsToKmh = (knots: number): number => knots * 1.852;
export const metersToKm = (meters: number): number => meters / 1000;
export const msDuration = (ms: number): string => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
