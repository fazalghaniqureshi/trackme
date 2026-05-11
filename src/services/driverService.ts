import type { Driver, DriverFormData } from "../types/driver";
import { generateId } from "../utils/format";

const STORAGE_KEY = "trackme_drivers";

const load = (): Driver[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const save = (drivers: Driver[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drivers));
  } catch (e) {
    console.error("Error saving drivers:", e);
  }
};

export const getAllDrivers = (): Driver[] => load();

export const getDriverById = (id: string): Driver | undefined =>
  load().find((d) => d.id === id);

export const getDriverByDeviceId = (deviceId: string): Driver | undefined =>
  load().find((d) => d.assignedDeviceId === deviceId);

export const createDriver = (formData: DriverFormData): Driver => {
  const drivers = load();
  const now = new Date().toISOString();
  const driver: Driver = {
    id: generateId(),
    name: formData.name.trim(),
    licenseNumber: formData.licenseNumber.trim(),
    licenseExpiry: formData.licenseExpiry,
    phone: formData.phone.trim(),
    email: formData.email.trim(),
    assignedDeviceId: formData.assignedDeviceId || null,
    notes: formData.notes.trim(),
    createdAt: now,
    updatedAt: now,
  };
  drivers.push(driver);
  save(drivers);
  return driver;
};

export const updateDriver = (id: string, formData: DriverFormData): Driver | null => {
  const drivers = load();
  const index = drivers.findIndex((d) => d.id === id);
  if (index === -1) return null;
  drivers[index] = {
    ...drivers[index],
    name: formData.name.trim(),
    licenseNumber: formData.licenseNumber.trim(),
    licenseExpiry: formData.licenseExpiry,
    phone: formData.phone.trim(),
    email: formData.email.trim(),
    assignedDeviceId: formData.assignedDeviceId || null,
    notes: formData.notes.trim(),
    updatedAt: new Date().toISOString(),
  };
  save(drivers);
  return drivers[index];
};

export const deleteDriver = (id: string): boolean => {
  const drivers = load();
  const filtered = drivers.filter((d) => d.id !== id);
  if (filtered.length === drivers.length) return false;
  save(filtered);
  return true;
};
