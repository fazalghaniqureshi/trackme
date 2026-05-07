export type MaintenanceServiceType =
  | "Oil Change"
  | "Tire Rotation"
  | "Brake Service"
  | "Air Filter"
  | "Transmission Service"
  | "Battery Replacement"
  | "Coolant Flush"
  | "Spark Plugs"
  | "Timing Belt"
  | "Fuel Filter"
  | "Wheel Alignment"
  | "General Inspection"
  | "Other";

export const SERVICE_TYPES: MaintenanceServiceType[] = [
  "Oil Change",
  "Tire Rotation",
  "Brake Service",
  "Air Filter",
  "Transmission Service",
  "Battery Replacement",
  "Coolant Flush",
  "Spark Plugs",
  "Timing Belt",
  "Fuel Filter",
  "Wheel Alignment",
  "General Inspection",
  "Other",
];

export interface MaintenanceRecord {
  id: string;
  deviceId: string;
  serviceType: MaintenanceServiceType;
  serviceDate: string; // "YYYY-MM-DD"
  odometer: number;    // km
  cost: number;
  notes: string;
  nextDueDate: string | null;    // "YYYY-MM-DD" or null
  nextDueOdometer: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceFormData {
  deviceId: string;
  serviceType: MaintenanceServiceType;
  serviceDate: string;
  odometer: string;
  cost: string;
  notes: string;
  nextDueDate: string;
  nextDueOdometer: string;
}
