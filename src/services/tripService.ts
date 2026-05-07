import type { Trip, LocationPoint } from "../types/trip";
import { calculateDistance } from "./analyticsService";

const TRIPS_STORAGE_KEY = "trackme_trips";

// Get all trips
export const getAllTrips = (): Trip[] => {
  try {
    const stored = localStorage.getItem(TRIPS_STORAGE_KEY);
    if (stored) {
      const trips = JSON.parse(stored);
      return trips.map((t: any) => ({
        ...t,
        startTime: new Date(t.startTime),
        endTime: t.endTime ? new Date(t.endTime) : undefined,
        locations: t.locations.map((l: any) => ({
          ...l,
          timestamp: new Date(l.timestamp),
        })),
      }));
    }
  } catch (error) {
    console.error("Error loading trips:", error);
  }
  return [];
};

// Get trips for a specific device
export const getDeviceTrips = (deviceId: string): Trip[] => {
  return getAllTrips().filter((t) => t.deviceId === deviceId);
};

// Get active trips
export const getActiveTrips = (): Trip[] => {
  return getAllTrips().filter((t) => t.isActive);
};

// Start a new trip
export const startTrip = (deviceId: string, location: LocationPoint): Trip => {
  const trips = getAllTrips();
  const newTrip: Trip = {
    id: Date.now().toString(),
    deviceId,
    startTime: location.timestamp,
    startLocation: location.coords,
    locations: [location],
    totalDistance: 0,
    maxSpeed: location.speed,
    avgSpeed: location.speed,
    duration: 0,
    isActive: true,
  };
  
  trips.push(newTrip);
  saveTrips(trips);
  return newTrip;
};

// Add location to active trip
export const addLocationToTrip = (deviceId: string, location: LocationPoint): void => {
  const trips = getAllTrips();
  const activeTrip = trips.find(
    (t) => t.deviceId === deviceId && t.isActive
  );
  
  if (activeTrip) {
    const lastLocation = activeTrip.locations[activeTrip.locations.length - 1];
    const distance = calculateDistance(
      lastLocation.coords,
      location.coords
    );
    
    activeTrip.locations.push(location);
    activeTrip.totalDistance += distance;
    activeTrip.maxSpeed = Math.max(activeTrip.maxSpeed, location.speed);
    
    // Calculate average speed
    const totalSpeed = activeTrip.locations.reduce(
      (sum, loc) => sum + loc.speed,
      0
    );
    activeTrip.avgSpeed = totalSpeed / activeTrip.locations.length;
    
    // Update duration
    activeTrip.duration =
      (location.timestamp.getTime() - activeTrip.startTime.getTime()) / 1000;
    
    saveTrips(trips);
  }
};

// End a trip
export const endTrip = (deviceId: string, location: LocationPoint): Trip | null => {
  const trips = getAllTrips();
  const activeTrip = trips.find(
    (t) => t.deviceId === deviceId && t.isActive
  );
  
  if (activeTrip) {
    activeTrip.isActive = false;
    activeTrip.endTime = location.timestamp;
    activeTrip.endLocation = location.coords;
    
    if (activeTrip.locations.length > 0) {
      const lastLocation = activeTrip.locations[activeTrip.locations.length - 1];
      const distance = calculateDistance(
        lastLocation.coords,
        location.coords
      );
      activeTrip.totalDistance += distance;
      activeTrip.locations.push(location);
    }
    
    saveTrips(trips);
    return activeTrip;
  }
  
  return null;
};

// Save trips to localStorage
const saveTrips = (trips: Trip[]): void => {
  try {
    localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
  } catch (error) {
    console.error("Error saving trips:", error);
  }
};

// Get trips in date range
export const getTripsInRange = (
  startDate: Date,
  endDate: Date
): Trip[] => {
  return getAllTrips().filter((trip) => {
    const tripDate = trip.startTime;
    return tripDate >= startDate && tripDate <= endDate;
  });
};

// Delete trip
export const deleteTrip = (tripId: string): boolean => {
  const trips = getAllTrips();
  const filtered = trips.filter((t) => t.id !== tripId);
  
  if (filtered.length === trips.length) return false;
  
  saveTrips(filtered);
  return true;
};

