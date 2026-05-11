import type { MaintenanceRecord, MaintenanceFormData } from "../types/maintenance";
import { generateId } from "../utils/format";

const STORAGE_KEY = "trackme_maintenance";

const load = (): MaintenanceRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const save = (records: MaintenanceRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error("Error saving maintenance records:", e);
  }
};

export const getAllMaintenanceRecords = (): MaintenanceRecord[] => load();

export const getMaintenanceByDevice = (deviceId: string): MaintenanceRecord[] =>
  load()
    .filter((r) => r.deviceId === deviceId)
    .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

export const createMaintenanceRecord = (formData: MaintenanceFormData): MaintenanceRecord => {
  const records = load();
  const now = new Date().toISOString();
  const record: MaintenanceRecord = {
    id: generateId(),
    deviceId: formData.deviceId,
    serviceType: formData.serviceType,
    serviceDate: formData.serviceDate,
    odometer: parseFloat(formData.odometer) || 0,
    cost: parseFloat(formData.cost) || 0,
    notes: formData.notes.trim(),
    nextDueDate: formData.nextDueDate || null,
    nextDueOdometer: formData.nextDueOdometer ? parseFloat(formData.nextDueOdometer) : null,
    createdAt: now,
    updatedAt: now,
  };
  records.push(record);
  save(records);
  return record;
};

export const updateMaintenanceRecord = (
  id: string,
  formData: MaintenanceFormData
): MaintenanceRecord | null => {
  const records = load();
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return null;
  records[index] = {
    ...records[index],
    deviceId: formData.deviceId,
    serviceType: formData.serviceType,
    serviceDate: formData.serviceDate,
    odometer: parseFloat(formData.odometer) || 0,
    cost: parseFloat(formData.cost) || 0,
    notes: formData.notes.trim(),
    nextDueDate: formData.nextDueDate || null,
    nextDueOdometer: formData.nextDueOdometer ? parseFloat(formData.nextDueOdometer) : null,
    updatedAt: new Date().toISOString(),
  };
  save(records);
  return records[index];
};

export const deleteMaintenanceRecord = (id: string): boolean => {
  const records = load();
  const filtered = records.filter((r) => r.id !== id);
  if (filtered.length === records.length) return false;
  save(filtered);
  return true;
};

export const getOverdueRecords = (): MaintenanceRecord[] => {
  const today = new Date().toISOString().slice(0, 10);
  return load().filter((r) => r.nextDueDate !== null && r.nextDueDate < today);
};

export const getUpcomingRecords = (withinDays = 30): MaintenanceRecord[] => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const limitStr = new Date(today.getTime() + withinDays * 86400000)
    .toISOString()
    .slice(0, 10);
  return load().filter(
    (r) => r.nextDueDate !== null && r.nextDueDate >= todayStr && r.nextDueDate <= limitStr
  );
};
