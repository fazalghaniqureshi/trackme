import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExpenseEntry } from '../types/local';

const KEY = 'trackme_mobile_expenses';

const load = async (): Promise<ExpenseEntry[]> => {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as ExpenseEntry[]; } catch { return []; }
};

const save = async (entries: ExpenseEntry[]): Promise<void> => {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
};

export const getAllExpenses = async (): Promise<ExpenseEntry[]> => {
  const entries = await load();
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const createExpense = async (data: Omit<ExpenseEntry, 'id' | 'createdAt'>): Promise<ExpenseEntry> => {
  const entries = await load();
  const entry: ExpenseEntry = {
    ...data,
    id: Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
  };
  await save([...entries, entry]);
  return entry;
};

export const deleteExpense = async (id: string): Promise<void> => {
  const entries = await load();
  await save(entries.filter((e) => e.id !== id));
};
