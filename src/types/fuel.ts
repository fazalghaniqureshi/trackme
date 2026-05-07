export interface FuelEntry {
  id: string;
  deviceId: string;
  date: string;          // "YYYY-MM-DD"
  liters: number;
  costPerLiter: number;
  totalCost: number;     // stored = liters * costPerLiter
  odometer: number;      // km at fill-up
  fuelEfficiency: number | null; // km/L vs previous fill-up, null if first
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FuelFormData {
  deviceId: string;
  date: string;
  liters: string;
  costPerLiter: string;
  odometer: string;
  notes: string;
}
