export type ExpenseCategory =
  | "Toll"
  | "Parking"
  | "Fine"
  | "Repair"
  | "Insurance"
  | "Registration"
  | "Car Wash"
  | "Other";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Toll",
  "Parking",
  "Fine",
  "Repair",
  "Insurance",
  "Registration",
  "Car Wash",
  "Other",
];

export interface ExpenseEntry {
  id: string;
  deviceId: string;
  category: ExpenseCategory;
  date: string;        // "YYYY-MM-DD"
  amount: number;
  description: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseFormData {
  deviceId: string;
  category: ExpenseCategory;
  date: string;
  amount: string;      // parsed on save
  description: string;
  notes: string;
}

export interface FleetExpenseStats {
  totalExpenses: number;
  totalCount: number;
  mostExpensiveCategory: ExpenseCategory | null;
  categoryTotals: Record<ExpenseCategory, number>;
}
