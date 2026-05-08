import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FuelEntry } from '../types/local';

const KEY = 'trackme_mobile_fuel';

const load = async (): Promise<FuelEntry[]> => {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as FuelEntry[]; } catch { return []; }
};

const save = async (entries: FuelEntry[]): Promise<void> => {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
};

export const getAllFuelEntries = async (): Promise<FuelEntry[]> => {
  const entries = await load();
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const createFuelEntry = async (data: Omit<FuelEntry, 'id' | 'fuelEfficiency' | 'totalCost' | 'createdAt'>): Promise<FuelEntry> => {
  const entries = await load();
  const totalCost = data.liters * data.costPerLiter;

  const prev = entries
    .filter((e) => e.deviceId === data.deviceId)
    .sort((a, b) => b.odometer - a.odometer)[0];

  const fuelEfficiency =
    prev && data.odometer > prev.odometer
      ? (data.odometer - prev.odometer) / data.liters
      : null;

  const entry: FuelEntry = {
    ...data,
    id: Math.random().toString(36).slice(2),
    totalCost,
    fuelEfficiency,
    createdAt: new Date().toISOString(),
  };
  await save([...entries, entry]);
  return entry;
};

export const deleteFuelEntry = async (id: string): Promise<void> => {
  const entries = await load();
  await save(entries.filter((e) => e.id !== id));
};
