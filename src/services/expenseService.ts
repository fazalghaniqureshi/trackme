import type {
  ExpenseEntry,
  ExpenseFormData,
  ExpenseCategory,
  FleetExpenseStats,
} from "../types/expense";
import { EXPENSE_CATEGORIES } from "../types/expense";

const STORAGE_KEY = "trackme_expenses";

const load = (): ExpenseEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const save = (entries: ExpenseEntry[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error("Error saving expenses:", e);
  }
};

export const getAllExpenses = (): ExpenseEntry[] => load();

export const getExpensesByDevice = (deviceId: string): ExpenseEntry[] =>
  load()
    .filter((e) => e.deviceId === deviceId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export const createExpense = (formData: ExpenseFormData): ExpenseEntry => {
  const entries = load();
  const now = new Date().toISOString();
  const entry: ExpenseEntry = {
    id: crypto.randomUUID(),
    deviceId: formData.deviceId,
    category: formData.category,
    date: formData.date,
    amount: parseFloat(formData.amount) || 0,
    description: formData.description.trim(),
    notes: formData.notes.trim(),
    createdAt: now,
    updatedAt: now,
  };
  entries.push(entry);
  save(entries);
  return entry;
};

export const updateExpense = (id: string, formData: ExpenseFormData): ExpenseEntry | null => {
  const entries = load();
  const index = entries.findIndex((e) => e.id === id);
  if (index === -1) return null;
  entries[index] = {
    ...entries[index],
    deviceId: formData.deviceId,
    category: formData.category,
    date: formData.date,
    amount: parseFloat(formData.amount) || 0,
    description: formData.description.trim(),
    notes: formData.notes.trim(),
    updatedAt: new Date().toISOString(),
  };
  save(entries);
  return entries[index];
};

export const deleteExpense = (id: string): boolean => {
  const entries = load();
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length === entries.length) return false;
  save(filtered);
  return true;
};

export const getFleetExpenseStats = (): FleetExpenseStats => {
  const entries = load();
  const categoryTotals = Object.fromEntries(
    EXPENSE_CATEGORIES.map((cat) => [
      cat,
      entries.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
    ])
  ) as Record<ExpenseCategory, number>;

  const mostExpensiveCategory: ExpenseCategory | null =
    entries.length === 0
      ? null
      : (Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0][0] as ExpenseCategory);

  return {
    totalExpenses: entries.reduce((s, e) => s + e.amount, 0),
    totalCount: entries.length,
    mostExpensiveCategory,
    categoryTotals,
  };
};
