export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  licenseExpiry: string; // "YYYY-MM-DD"
  phone: string;
  email: string;
  assignedDeviceId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  traccarUserId?: number;
}

export interface DriverFormData {
  name: string;
  licenseNumber: string;
  licenseExpiry: string;
  phone: string;
  email: string;
  assignedDeviceId: string; // "" = unassigned
  notes: string;
  traccarUserId?: number;
}
