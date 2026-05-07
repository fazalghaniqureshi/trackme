// Device types for Teltonika GPS trackers

// Supported Teltonika device models
export type TeltonikaModel =
  | "FMB001"
  | "FMB010"
  | "FMB100"
  | "FMB110"
  | "FMB120"
  | "FMB122"
  | "FMB125"
  | "FMB130"
  | "FMB140"
  | "FMB900"
  | "FMB920"
  | "FMB962"
  | "FMB964"
  | "FMC001"
  | "FMC110"
  | "FMC125"
  | "FMC130"
  | "FMM001"
  | "FMM640"
  | "FMP100"
  | "FMT100"
  | "FMT250"
  | "GH3000"
  | "GH5200"
  | "Other";

export interface Device {
  id: string;
  name: string;
  imei: string;
  model: TeltonikaModel;
  traccarId?: number;
  status: "online" | "offline" | "unknown";
  lastUpdate?: Date;
  coords: [number, number];
  prevCoords: [number, number];
  angle: number;
  speed?: number;
  battery?: number;
  signal?: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceFormData {
  name: string;
  imei: string;
  model: TeltonikaModel;
  description?: string;
  initialLat?: number;
  initialLon?: number;
}
