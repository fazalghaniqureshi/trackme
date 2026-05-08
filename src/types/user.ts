export type TrackMeRole = "admin" | "fleet_manager" | "driver";

export interface TraccarUser {
  id: number;
  name: string;
  email: string;
  admin: boolean;
  disabled?: boolean;
  attributes: {
    trackme_role?: TrackMeRole;
    [key: string]: unknown;
  };
}

export interface TraccarGroup {
  id: number;
  name: string;
  groupId?: number;
  attributes?: Record<string, unknown>;
}

export interface PermissionLink {
  userId?: number;
  deviceId?: number;
  groupId?: number;
}

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: "fleet_manager" | "driver";
  assignedGroupIds: number[];
  assignedDeviceIds: number[];
}

export const ROLE_LABEL: Record<TrackMeRole, string> = {
  admin: "Admin",
  fleet_manager: "Fleet Manager",
  driver: "Driver",
};

export const ROLE_COLOR: Record<TrackMeRole, string> = {
  admin: "#f59e0b",
  fleet_manager: "#3b82f6",
  driver: "#8b5cf6",
};
