import type { Credentials } from './authService';
import type {
  TraccarDevice, TraccarPosition, TraccarTrip,
  TraccarEvent, TraccarGeofence, TraccarUser,
} from '../types/traccar';

let _creds: Credentials | null = null;

export const setCredentials = (creds: Credentials): void => { _creds = creds; };

const api = async (path: string, options: RequestInit = {}): Promise<Response> => {
  if (!_creds) throw new Error('Not authenticated');
  const auth = btoa(`${_creds.email}:${_creds.password}`);
  return fetch(`${_creds.serverUrl}/api/${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
};

export const getDevices = async (): Promise<TraccarDevice[]> => {
  const res = await api('devices');
  if (!res.ok) return [];
  return res.json() as Promise<TraccarDevice[]>;
};

export const getPositions = async (deviceIds: number[]): Promise<TraccarPosition[]> => {
  if (deviceIds.length === 0) return [];
  const params = deviceIds.map((id) => `id=${id}`).join('&');
  const res = await api(`positions?${params}`);
  if (!res.ok) return [];
  return res.json() as Promise<TraccarPosition[]>;
};

export const getTrips = async (
  deviceId: number,
  from: Date,
  to: Date
): Promise<TraccarTrip[]> => {
  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await api(`reports/trips?${params}`);
  if (!res.ok) return [];
  return res.json() as Promise<TraccarTrip[]>;
};

export const getLocationHistory = async (
  deviceId: number,
  from: Date,
  to: Date
): Promise<TraccarPosition[]> => {
  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await api(`positions?${params}`);
  if (!res.ok) return [];
  return res.json() as Promise<TraccarPosition[]>;
};

export const getEvents = async (
  deviceId: number,
  from: Date,
  to: Date
): Promise<TraccarEvent[]> => {
  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await api(`reports/events?${params}`);
  if (!res.ok) return [];
  return res.json() as Promise<TraccarEvent[]>;
};

export const getGeofences = async (): Promise<TraccarGeofence[]> => {
  const res = await api('geofences');
  if (!res.ok) return [];
  return res.json() as Promise<TraccarGeofence[]>;
};

export const getSummary = async (
  from: Date,
  to: Date,
  deviceId?: number
): Promise<unknown[]> => {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    ...(deviceId ? { deviceId: String(deviceId) } : {}),
  });
  const res = await api(`reports/summary?${params}`);
  if (!res.ok) return [];
  return res.json() as Promise<unknown[]>;
};

export const updateUserPushToken = async (
  userId: number,
  token: string
): Promise<void> => {
  const userRes = await api(`users/${userId}`);
  if (!userRes.ok) return;
  const user = (await userRes.json()) as TraccarUser;
  await api(`users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...user,
      attributes: { ...user.attributes, expo_push_token: token },
    }),
  });
};
