import type { Device, DeviceFormData } from "../types/device";
import { syncTraccarDevices, isTraccarConfigured } from "./traccarService";

const STORAGE_KEY = "trackme_devices";
const STORAGE_VERSION_KEY = "trackme_devices_version";
const STORAGE_VERSION = "3"; // bump to clear stale / fake seed data

// Clear legacy data from older versions (fake demo devices, etc.)
if (localStorage.getItem(STORAGE_VERSION_KEY) !== STORAGE_VERSION) {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
}

// ---------------------------------------------------------------------------
// localStorage helpers — used only when Traccar is NOT connected
// ---------------------------------------------------------------------------

const loadLocalDevices = (): Device[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const devices = JSON.parse(stored);
      return devices.map((d: any) => ({
        ...d,
        lastUpdate: d.lastUpdate ? new Date(d.lastUpdate) : undefined,
        createdAt: new Date(d.createdAt),
        updatedAt: new Date(d.updatedAt),
      }));
    }
  } catch (error) {
    console.error("Error loading local devices:", error);
  }
  return [];
};

const saveLocalDevices = (devices: Device[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch (error) {
    console.error("Error saving local devices:", error);
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Synchronous read — returns localStorage devices.
 * Only use this when Traccar is not available.
 */
export const getAllDevices = (): Device[] => loadLocalDevices();

/**
 * Primary read — always fetches live data from Traccar when connected.
 * Falls back to localStorage if Traccar is not configured.
 */
export const getAllDevicesWithTraccar = async (): Promise<Device[]> => {
  if (isTraccarConfigured()) {
    try {
      return await syncTraccarDevices();
    } catch (error) {
      console.error("Error fetching devices from Traccar:", error);
    }
  }
  return loadLocalDevices();
};

export const getDeviceById = (id: string): Device | undefined =>
  loadLocalDevices().find((d) => d.id === id);

/**
 * Create a device in localStorage (fallback when Traccar is not connected).
 * When Traccar IS connected, use createTraccarDevice() from traccarService instead.
 */
export const createDevice = (formData: DeviceFormData): Device => {
  const devices = loadLocalDevices();
  const now = new Date();
  const newDevice: Device = {
    id: Date.now().toString(),
    name: formData.name,
    imei: formData.imei,
    model: formData.model,
    traccarId: undefined,
    status: "unknown",
    coords:
      formData.initialLat && formData.initialLon
        ? [formData.initialLat, formData.initialLon]
        : [33.5816, 71.4492],
    prevCoords:
      formData.initialLat && formData.initialLon
        ? [formData.initialLat, formData.initialLon]
        : [33.5816, 71.4492],
    angle: 0,
    description: formData.description,
    createdAt: now,
    updatedAt: now,
  };
  devices.push(newDevice);
  saveLocalDevices(devices);
  return newDevice;
};

export const updateDevice = (id: string, updates: Partial<Device>): Device | null => {
  const devices = loadLocalDevices();
  const index = devices.findIndex((d) => d.id === id);
  if (index === -1) return null;
  devices[index] = { ...devices[index], ...updates, updatedAt: new Date() };
  saveLocalDevices(devices);
  return devices[index];
};

export const deleteDevice = (id: string): boolean => {
  const devices = loadLocalDevices();
  const filtered = devices.filter((d) => d.id !== id);
  if (filtered.length === devices.length) return false;
  saveLocalDevices(filtered);
  return true;
};

export const validateIMEI = (imei: string): boolean => /^\d{15,16}$/.test(imei);

// Keep export for any legacy references — no-op now
export const saveDevices = saveLocalDevices;
export const loadDevices = loadLocalDevices;
