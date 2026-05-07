import type { FleetStatistics } from "../types/trip";
import { getAllDevices } from "./deviceService";
import { getAllTrips, getActiveTrips } from "./tripService";

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (
  coord1: [number, number],
  coord2: [number, number]
): number => {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Get fleet statistics
export const getFleetStatistics = (): FleetStatistics => {
  const devices = getAllDevices();
  const trips = getAllTrips();
  const activeTrips = getActiveTrips();
  
  const onlineDevices = devices.filter((d) => d.status === "online").length;
  const offlineDevices = devices.filter((d) => d.status === "offline").length;
  
  const completedTrips = trips.filter((t) => !t.isActive);
  const totalDistance = completedTrips.reduce(
    (sum, trip) => sum + trip.totalDistance,
    0
  );
  
  const allSpeeds = trips.flatMap((trip) =>
    trip.locations.map((loc) => loc.speed)
  );
  
  const avgSpeed =
    allSpeeds.length > 0
      ? allSpeeds.reduce((sum, speed) => sum + speed, 0) / allSpeeds.length
      : 0;
  
  const maxSpeed = allSpeeds.length > 0 ? Math.max(...allSpeeds) : 0;
  
  return {
    totalDevices: devices.length,
    onlineDevices,
    offlineDevices,
    totalTrips: completedTrips.length,
    activeTrips: activeTrips.length,
    totalDistance,
    avgSpeed: Math.round(avgSpeed * 100) / 100,
    maxSpeed: Math.round(maxSpeed * 100) / 100,
  };
};

// Get device statistics
export const getDeviceStatistics = (deviceId: string) => {
  const trips = getAllTrips().filter((t) => t.deviceId === deviceId);
  const completedTrips = trips.filter((t) => !t.isActive);
  
  const totalDistance = completedTrips.reduce(
    (sum, trip) => sum + trip.totalDistance,
    0
  );
  
  const totalDuration = completedTrips.reduce(
    (sum, trip) => sum + trip.duration,
    0
  );
  
  const allSpeeds = trips.flatMap((trip) =>
    trip.locations.map((loc) => loc.speed)
  );
  
  const avgSpeed =
    allSpeeds.length > 0
      ? allSpeeds.reduce((sum, speed) => sum + speed, 0) / allSpeeds.length
      : 0;
  
  return {
    totalTrips: completedTrips.length,
    totalDistance,
    totalDuration,
    avgSpeed: Math.round(avgSpeed * 100) / 100,
    maxSpeed: Math.round(Math.max(...allSpeeds, 0) * 100) / 100,
  };
};

// Get speed data for chart (last 24 hours)
export const getSpeedChartData = (deviceId: string) => {
  const trips = getAllTrips().filter((t) => t.deviceId === deviceId);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const recentLocations = trips
    .flatMap((trip) => trip.locations)
    .filter((loc) => loc.timestamp >= yesterday)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Group by hour
  const hourlyData: Record<string, number[]> = {};
  
  recentLocations.forEach((loc) => {
    const hour = new Date(loc.timestamp).toISOString().slice(0, 13) + ":00";
    if (!hourlyData[hour]) {
      hourlyData[hour] = [];
    }
    hourlyData[hour].push(loc.speed);
  });
  
  return Object.entries(hourlyData).map(([hour, speeds]) => ({
    time: hour.slice(11, 16),
    speed: Math.round(
      speeds.reduce((sum, s) => sum + s, 0) / speeds.length
    ),
  }));
};

// Get distance chart data (last 7 days)
export const getDistanceChartData = () => {
  const trips = getAllTrips().filter((t) => !t.isActive);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentTrips = trips.filter(
    (trip) => trip.startTime >= sevenDaysAgo
  );
  
  // Group by day
  const dailyData: Record<string, number> = {};
  
  recentTrips.forEach((trip) => {
    const day = trip.startTime.toISOString().slice(0, 10);
    dailyData[day] = (dailyData[day] || 0) + trip.totalDistance;
  });
  
  return Object.entries(dailyData).map(([date, distance]) => ({
    date: new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    distance: Math.round(distance * 100) / 100,
  }));
};

// Get device status distribution
export const getDeviceStatusData = () => {
  const devices = getAllDevices();
  const statusCounts = {
    online: devices.filter((d) => d.status === "online").length,
    offline: devices.filter((d) => d.status === "offline").length,
    unknown: devices.filter((d) => d.status === "unknown").length,
  };
  
  return [
    { name: "Online", value: statusCounts.online, color: "#28a745" },
    { name: "Offline", value: statusCounts.offline, color: "#dc3545" },
    { name: "Unknown", value: statusCounts.unknown, color: "#6c757d" },
  ];
};

