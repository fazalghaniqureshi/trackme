export interface FuelEntry {
  id: string;
  deviceId: string;
  date: string;        // "YYYY-MM-DD"
  liters: number;
  costPerLiter: number;
  totalCost: number;
  odometer: number;
  fuelEfficiency: number | null; // km/L
  notes: string;
  createdAt: string;
}

export interface ExpenseEntry {
  id: string;
  deviceId: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  notes: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'Toll' | 'Parking' | 'Fine' | 'Repair'
  | 'Insurance' | 'Registration' | 'Car Wash' | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Toll', 'Parking', 'Fine', 'Repair',
  'Insurance', 'Registration', 'Car Wash', 'Other',
];

export const formatCurrency = (amount: number): string =>
  `Rs. ${amount.toFixed(2)}`;
