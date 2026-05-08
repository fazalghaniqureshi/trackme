import type { TraccarUser, TrackMeRole, UserFormData } from "../types/user";
import {
  getTraccarUsers,
  createTraccarUser,
  updateTraccarUser,
  deleteTraccarUser,
  addTraccarPermission,
  removeTraccarPermission,
  getTraccarGroups,
} from "./traccarService";

// ── Role cache (synchronous read from localStorage) ──────────────────────────

export const getMyRole = (): TrackMeRole | null => {
  const cached = localStorage.getItem("trackme_current_role");
  if (cached === "admin" || cached === "fleet_manager" || cached === "driver") return cached;
  return null;
};

export const isAdmin = (): boolean => getMyRole() === "admin";
export const isFleetManager = (): boolean => getMyRole() === "fleet_manager";
export const isDriver = (): boolean => getMyRole() === "driver";
export const canManageUsers = (): boolean => isAdmin() || isFleetManager();

// ── User CRUD ─────────────────────────────────────────────────────────────────

export const getAllUsers = async (): Promise<TraccarUser[]> => {
  return getTraccarUsers();
};

export const createUser = async (data: UserFormData): Promise<TraccarUser> => {
  const user = await createTraccarUser({
    name: data.name,
    email: data.email,
    password: data.password,
    attributes: { trackme_role: data.role },
  });

  for (const groupId of data.assignedGroupIds) {
    await addTraccarPermission({ userId: user.id, groupId });
  }

  for (const deviceId of data.assignedDeviceIds) {
    await addTraccarPermission({ userId: user.id, deviceId });
  }

  return user;
};

export const updateUser = async (
  id: number,
  data: UserFormData,
  previousDeviceIds: number[],
  previousGroupIds: number[]
): Promise<TraccarUser> => {
  const user = await updateTraccarUser(id, {
    name: data.name,
    email: data.email,
    ...(data.password ? { password: data.password } : {}),
    attributes: { trackme_role: data.role },
  });

  for (const gId of previousGroupIds) {
    if (!data.assignedGroupIds.includes(gId))
      await removeTraccarPermission({ userId: id, groupId: gId });
  }
  for (const gId of data.assignedGroupIds) {
    if (!previousGroupIds.includes(gId))
      await addTraccarPermission({ userId: id, groupId: gId });
  }

  for (const dId of previousDeviceIds) {
    if (!data.assignedDeviceIds.includes(dId))
      await removeTraccarPermission({ userId: id, deviceId: dId });
  }
  for (const dId of data.assignedDeviceIds) {
    if (!previousDeviceIds.includes(dId))
      await addTraccarPermission({ userId: id, deviceId: dId });
  }

  return user;
};

export const deleteUser = async (id: number): Promise<void> => {
  await deleteTraccarUser(id);
};

// ── Device-driver assignment ──────────────────────────────────────────────────

export const assignDriverToDevice = async (
  userId: number,
  deviceId: number
): Promise<void> => {
  await addTraccarPermission({ userId, deviceId });
};

export const removeDriverFromDevice = async (
  userId: number,
  deviceId: number
): Promise<void> => {
  await removeTraccarPermission({ userId, deviceId });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export const getUserRole = (user: TraccarUser): TrackMeRole => {
  if (user.admin) return "admin";
  return (user.attributes.trackme_role as TrackMeRole) ?? "driver";
};

export const getFleetManagerGroups = async (): Promise<{ id: number; name: string }[]> => {
  return getTraccarGroups();
};
