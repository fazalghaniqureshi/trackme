import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackMeRole, TraccarUser } from '../types/traccar';

const CRED_KEY = 'traccar_credentials';
const ROLE_KEY = 'trackme_current_role';

export interface Credentials {
  serverUrl: string;
  email: string;
  password: string;
}

export const saveCredentials = async (creds: Credentials): Promise<void> => {
  await SecureStore.setItemAsync(CRED_KEY, JSON.stringify(creds));
};

export const loadCredentials = async (): Promise<Credentials | null> => {
  const raw = await SecureStore.getItemAsync(CRED_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Credentials; } catch { return null; }
};

export const clearCredentials = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(CRED_KEY);
  await AsyncStorage.removeItem(ROLE_KEY);
};

export const saveRole = async (role: TrackMeRole): Promise<void> => {
  await AsyncStorage.setItem(ROLE_KEY, role);
};

export const loadRole = async (): Promise<TrackMeRole | null> => {
  const r = await AsyncStorage.getItem(ROLE_KEY);
  if (r === 'admin' || r === 'fleet_manager' || r === 'driver') return r;
  return null;
};

export const login = async (
  serverUrl: string,
  email: string,
  password: string
): Promise<{ user: TraccarUser; role: TrackMeRole }> => {
  const base = serverUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  });

  if (!res.ok) throw new Error('Invalid credentials');

  const user = (await res.json()) as TraccarUser;
  const role: TrackMeRole = user.admin
    ? 'admin'
    : (user.attributes.trackme_role ?? 'driver');

  await saveCredentials({ serverUrl: base, email, password });
  await saveRole(role);

  return { user, role };
};

export const verifySession = async (creds: Credentials): Promise<TrackMeRole | null> => {
  try {
    const auth = btoa(`${creds.email}:${creds.password}`);
    const res = await fetch(`${creds.serverUrl}/api/session`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as TraccarUser;
    const role: TrackMeRole = user.admin
      ? 'admin'
      : (user.attributes.trackme_role ?? 'driver');
    await saveRole(role);
    return role;
  } catch {
    return null;
  }
};
