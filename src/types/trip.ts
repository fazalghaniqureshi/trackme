// Trip and location history types

export interface LocationPoint {
  timestamp: Date;
  coords: [number, number];
  speed: number;
  angle: number;
  battery?: number;
  signal?: number;
}

export interface Trip {
  id: string;
  deviceId: string;
  startTime: Date;
  endTime?: Date;
  startLocation: [number, number];
  endLocation?: [number, number];
  locations: LocationPoint[];
  totalDistance: number; // in kilometers
  maxSpeed: number;
  avgSpeed: number;
  duration: number; // in seconds
  isActive: boolean;
}

export interface FleetStatistics {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalTrips: number;
  activeTrips: number;
  totalDistance: number;
  avgSpeed: number;
  maxSpeed: number;
}

