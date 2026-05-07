import type { FuelEntry, FuelFormData } from "../types/fuel";

const STORAGE_KEY = "trackme_fuel";

const load = (): FuelEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const save = (entries: FuelEntry[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error("Error saving fuel entries:", e);
  }
};

export const getAllFuelEntries = (): FuelEntry[] => load();

export const getFuelEntriesByDevice = (deviceId: string): FuelEntry[] =>
  load()
    .filter((e) => e.deviceId === deviceId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

const calcEfficiency = (
  entries: FuelEntry[],
  deviceId: string,
  odometer: number,
  liters: number,
  excludeId?: string
): number | null => {
  const prev = entries
    .filter((e) => e.deviceId === deviceId && e.odometer < odometer && e.id !== excludeId)
    .sort((a, b) => b.odometer - a.odometer)[0];
  if (!prev || liters <= 0) return null;
  return parseFloat(((odometer - prev.odometer) / liters).toFixed(2));
};

export const createFuelEntry = (formData: FuelFormData): FuelEntry => {
  const entries = load();
  const liters = parseFloat(formData.liters) || 0;
  const costPerLiter = parseFloat(formData.costPerLiter) || 0;
  const odometer = parseFloat(formData.odometer) || 0;
  const now = new Date().toISOString();
  const entry: FuelEntry = {
    id: crypto.randomUUID(),
    deviceId: formData.deviceId,
    date: formData.date,
    liters,
    costPerLiter,
    totalCost: parseFloat((liters * costPerLiter).toFixed(2)),
    odometer,
    fuelEfficiency: calcEfficiency(entries, formData.deviceId, odometer, liters),
    notes: formData.notes.trim(),
    createdAt: now,
    updatedAt: now,
  };
  entries.push(entry);
  save(entries);
  return entry;
};

export const updateFuelEntry = (id: string, formData: FuelFormData): FuelEntry | null => {
  const entries = load();
  const index = entries.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const liters = parseFloat(formData.liters) || 0;
  const costPerLiter = parseFloat(formData.costPerLiter) || 0;
  const odometer = parseFloat(formData.odometer) || 0;
  entries[index] = {
    ...entries[index],
    deviceId: formData.deviceId,
    date: formData.date,
    liters,
    costPerLiter,
    totalCost: parseFloat((liters * costPerLiter).toFixed(2)),
    odometer,
    fuelEfficiency: calcEfficiency(entries, formData.deviceId, odometer, liters, id),
    notes: formData.notes.trim(),
    updatedAt: new Date().toISOString(),
  };
  save(entries);
  return entries[index];
};

export const deleteFuelEntry = (id: string): boolean => {
  const entries = load();
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length === entries.length) return false;
  save(filtered);
  return true;
};

export const getFleetFuelStats = () => {
  const entries = load();
  const totalLiters = entries.reduce((s, e) => s + e.liters, 0);
  const totalCost = entries.reduce((s, e) => s + e.totalCost, 0);
  const efficiencies = entries
    .map((e) => e.fuelEfficiency)
    .filter((e): e is number => e !== null);
  const avgEfficiency =
    efficiencies.length > 0
      ? efficiencies.reduce((s, e) => s + e, 0) / efficiencies.length
      : null;
  return { totalFillUps: entries.length, totalLiters, totalCost, avgEfficiency };
};
