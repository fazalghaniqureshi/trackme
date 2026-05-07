// Traccar Reports & Events types

export interface TraccarTripReport {
  deviceId: number;
  deviceName: string;
  maxSpeed: number;      // knots — multiply by 1.852 for km/h
  averageSpeed: number;  // knots
  distance: number;      // meters
  duration: number;      // milliseconds
  startTime: string;     // ISO
  endTime: string;       // ISO
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  startAddress?: string;
  endAddress?: string;
  driverName?: string;
  spentFuel?: number;
}

export interface TraccarSummaryReport {
  deviceId: number;
  deviceName: string;
  maxSpeed: number;      // knots
  averageSpeed: number;  // knots
  distance: number;      // meters
  engineHours?: number;  // milliseconds
  spentFuel?: number;
}

export interface TraccarEvent {
  id: number;
  deviceId: number;
  type: string; // "deviceOverspeed" | "geofenceEnter" | "geofenceExit" | "deviceStopped" | "deviceMoving" | ...
  eventTime: string; // ISO
  positionId?: number;
  geofenceId?: number;
  maintenanceId?: number;
  attributes?: {
    speed?: number; // knots
    message?: string;
    [key: string]: unknown;
  };
}

// Unit helpers
export const knotsToKmh = (knots: number): number => knots * 1.852;
export const metersToKm = (meters: number): number => meters / 1000;
export const msDuration = (ms: number): string => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Event type display metadata
export const EVENT_META: Record<string, { label: string; color: string }> = {
  deviceOverspeed:  { label: "Speed Alert",    color: "danger" },
  geofenceEnter:    { label: "Entered Zone",   color: "primary" },
  geofenceExit:     { label: "Exited Zone",    color: "warning" },
  deviceStopped:    { label: "Stopped",        color: "secondary" },
  deviceMoving:     { label: "Moving",         color: "success" },
  deviceOnline:     { label: "Came Online",    color: "success" },
  deviceOffline:    { label: "Went Offline",   color: "danger" },
  ignitionOn:       { label: "Ignition On",    color: "info" },
  ignitionOff:      { label: "Ignition Off",   color: "secondary" },
};
