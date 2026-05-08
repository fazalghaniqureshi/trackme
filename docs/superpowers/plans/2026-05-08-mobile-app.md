# TrackMe Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-featured React Native + Expo mobile app for TrackMe with role-based navigation — Manager (map, dashboard, trips, alerts) and Driver (map, vehicles, trips, fuel/expense log) — connecting to the same Traccar backend as the web app.

**Architecture:** New Expo project in `trackme/mobile/` using Expo Router for file-based routing. Authentication via Traccar HTTP Basic auth stored in SecureStore. Role read from Traccar user attributes on login determines which tab group renders. Direct API calls to Traccar (no proxy). Local data (fuel, expenses) in AsyncStorage.

**Tech Stack:** Expo ~52, expo-router ~4, react-native-maps, expo-secure-store, expo-notifications, AsyncStorage, victory-native, date-fns

---

## Task 1: Scaffold Expo app + install dependencies

**Files:**
- Create: `mobile/` directory (via Expo CLI)
- Create: `mobile/.env`
- Create: `mobile/tsconfig.json` (auto-generated, then adjust)

- [ ] **Step 1: Create the Expo app**

Run from `C:\trackme`:
```powershell
npx create-expo-app mobile --template blank-typescript
```
Expected: `mobile/` directory created with `app.json`, `package.json`, `App.tsx`, `tsconfig.json`.

- [ ] **Step 2: Install all dependencies**

```powershell
cd mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install react-native-maps expo-secure-store expo-notifications @react-native-async-storage/async-storage
npx expo install victory-native react-native-svg
npm install date-fns
```

- [ ] **Step 3: Configure Expo Router in `mobile/app.json`**

Replace the `expo` section's `main` field. Open `mobile/app.json` and ensure it contains:
```json
{
  "expo": {
    "name": "TrackMe",
    "slug": "trackme-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "trackme",
    "userInterfaceStyle": "dark",
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.trackme.mobile"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#080f1e"
      },
      "package": "com.trackme.mobile"
    },
    "plugins": [
      "expo-router",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#3b82f6"
        }
      ],
      [
        "react-native-maps",
        {
          "googleMapsApiKey": ""
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 4: Update `mobile/package.json` main entry**

In `mobile/package.json`, ensure:
```json
{
  "main": "expo-router/entry"
}
```

- [ ] **Step 5: Create `.env` file**

Create `mobile/.env`:
```
EXPO_PUBLIC_TRACCAR_URL=http://localhost:8082
```
(Change to real server URL when Oracle VM is live.)

- [ ] **Step 6: Copy vehicle icon assets**

```powershell
mkdir mobile\assets
Copy-Item ..\src\assets\images\icon_blue.png mobile\assets\icon_blue.png
Copy-Item ..\src\assets\images\icon_gray.png mobile\assets\icon_gray.png
```

- [ ] **Step 7: Delete auto-generated `App.tsx`**

```powershell
Remove-Item mobile\App.tsx -ErrorAction SilentlyContinue
```

- [ ] **Step 8: Create minimal `mobile/app/_layout.tsx` to verify Expo Router works**

Create `mobile/app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `mobile/app/index.tsx`:
```tsx
import { Text, View } from 'react-native';
export default function Index() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080f1e' }}><Text style={{ color: '#e2eaf6' }}>TrackMe Mobile</Text></View>;
}
```

- [ ] **Step 9: Verify the app starts**

```powershell
cd mobile && npx expo start --clear
```
Expected: Expo DevTools opens. Scan QR with Expo Go on phone OR press `a` for Android emulator. App shows "TrackMe Mobile" on dark background.

- [ ] **Step 10: Commit**

```powershell
cd ..
git add mobile/
git commit -m "feat(mobile): scaffold Expo app with expo-router and all dependencies"
```

---

## Task 2: Types

**Files:**
- Create: `mobile/types/traccar.ts`
- Create: `mobile/types/local.ts`

- [ ] **Step 1: Create `mobile/types/traccar.ts`**

```typescript
export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'unknown';
  lastUpdate?: string;
  positionId?: number;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;   // KNOTS — multiply by 1.852 for km/h
  course: number;  // heading degrees
  fixTime: string; // ISO
  attributes?: {
    batteryLevel?: number;
    ignition?: boolean;
    motion?: boolean;
    [key: string]: unknown;
  };
}

export interface TraccarTrip {
  deviceId: number;
  deviceName: string;
  startTime: string;
  endTime: string;
  startAddress?: string;
  endAddress?: string;
  distance: number;       // metres
  averageSpeed: number;   // knots
  maxSpeed: number;       // knots
  duration: number;       // milliseconds
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
}

export interface TraccarEvent {
  id: number;
  deviceId: number;
  type: string;
  eventTime: string;
  positionId?: number;
  attributes?: Record<string, unknown>;
}

export interface TraccarGeofence {
  id: number;
  name: string;
  description?: string;
  area: string; // WKT e.g. "CIRCLE (lat lon, radius)"
}

export interface TraccarUser {
  id: number;
  name: string;
  email: string;
  admin: boolean;
  attributes: {
    trackme_role?: 'admin' | 'fleet_manager' | 'driver';
    expo_push_token?: string;
    [key: string]: unknown;
  };
}

export type TrackMeRole = 'admin' | 'fleet_manager' | 'driver';

// Speed conversion helpers
export const knotsToKmh = (knots: number): number => knots * 1.852;
export const metersToKm = (meters: number): number => meters / 1000;
export const msDuration = (ms: number): string => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
```

- [ ] **Step 2: Create `mobile/types/local.ts`**

```typescript
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
```

- [ ] **Step 3: Type-check**

```powershell
cd mobile && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```powershell
cd ..
git add mobile/types/
git commit -m "feat(mobile): add Traccar and local data types"
```

---

## Task 3: Auth service

**Files:**
- Create: `mobile/services/authService.ts`

- [ ] **Step 1: Create `mobile/services/authService.ts`**

```typescript
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
  const auth = btoa(`${email}:${password}`);

  // Verify credentials by fetching current user
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
```

- [ ] **Step 2: Type-check**

```powershell
cd mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
cd ..
git add mobile/services/authService.ts
git commit -m "feat(mobile): add authService — login, SecureStore credentials, role cache"
```

---

## Task 4: Traccar service

**Files:**
- Create: `mobile/services/traccarService.ts`

- [ ] **Step 1: Create `mobile/services/traccarService.ts`**

```typescript
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
```

- [ ] **Step 2: Type-check and commit**

```powershell
cd mobile && npx tsc --noEmit
cd ..
git add mobile/services/traccarService.ts
git commit -m "feat(mobile): add traccarService — devices, positions, trips, events, geofences"
```

---

## Task 5: Local data services (fuel + expense)

**Files:**
- Create: `mobile/services/fuelService.ts`
- Create: `mobile/services/expenseService.ts`

- [ ] **Step 1: Create `mobile/services/fuelService.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FuelEntry } from '../types/local';

const KEY = 'trackme_mobile_fuel';

const load = async (): Promise<FuelEntry[]> => {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as FuelEntry[]; } catch { return []; }
};

const save = async (entries: FuelEntry[]): Promise<void> => {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
};

export const getAllFuelEntries = async (): Promise<FuelEntry[]> => {
  const entries = await load();
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const createFuelEntry = async (data: Omit<FuelEntry, 'id' | 'fuelEfficiency' | 'totalCost' | 'createdAt'>): Promise<FuelEntry> => {
  const entries = await load();
  const totalCost = data.liters * data.costPerLiter;

  // Calculate efficiency vs previous fill-up for same device
  const prev = entries
    .filter((e) => e.deviceId === data.deviceId)
    .sort((a, b) => b.odometer - a.odometer)[0];

  const fuelEfficiency =
    prev && data.odometer > prev.odometer
      ? (data.odometer - prev.odometer) / data.liters
      : null;

  const entry: FuelEntry = {
    ...data,
    id: Math.random().toString(36).slice(2),
    totalCost,
    fuelEfficiency,
    createdAt: new Date().toISOString(),
  };
  await save([...entries, entry]);
  return entry;
};

export const deleteFuelEntry = async (id: string): Promise<void> => {
  const entries = await load();
  await save(entries.filter((e) => e.id !== id));
};
```

- [ ] **Step 2: Create `mobile/services/expenseService.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExpenseEntry } from '../types/local';

const KEY = 'trackme_mobile_expenses';

const load = async (): Promise<ExpenseEntry[]> => {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as ExpenseEntry[]; } catch { return []; }
};

const save = async (entries: ExpenseEntry[]): Promise<void> => {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
};

export const getAllExpenses = async (): Promise<ExpenseEntry[]> => {
  const entries = await load();
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const createExpense = async (data: Omit<ExpenseEntry, 'id' | 'createdAt'>): Promise<ExpenseEntry> => {
  const entries = await load();
  const entry: ExpenseEntry = {
    ...data,
    id: Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
  };
  await save([...entries, entry]);
  return entry;
};

export const deleteExpense = async (id: string): Promise<void> => {
  const entries = await load();
  await save(entries.filter((e) => e.id !== id));
};
```

- [ ] **Step 3: Type-check and commit**

```powershell
cd mobile && npx tsc --noEmit
cd ..
git add mobile/services/fuelService.ts mobile/services/expenseService.ts
git commit -m "feat(mobile): add fuelService and expenseService with AsyncStorage"
```

---

## Task 6: Hooks — polling + route replay

**Files:**
- Create: `mobile/hooks/useFleetPolling.ts`
- Create: `mobile/hooks/useMapRoute.ts`

- [ ] **Step 1: Create `mobile/hooks/useFleetPolling.ts`**

```typescript
import { useState, useEffect, useRef } from 'react';
import { getDevices, getPositions } from '../services/traccarService';
import type { TraccarDevice, TraccarPosition } from '../types/traccar';
import { knotsToKmh } from '../types/traccar';

export interface DeviceWithPosition extends TraccarDevice {
  position?: TraccarPosition;
  speedKmh: number;
  coords: { latitude: number; longitude: number };
  angle: number;
}

export const useFleetPolling = (intervalMs = 5000) => {
  const [devices, setDevices] = useState<DeviceWithPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    try {
      const devs = await getDevices();
      if (devs.length === 0) { setDevices([]); setLoading(false); return; }
      const ids = devs.map((d) => d.id);
      const positions = await getPositions(ids);
      const posMap = new Map(positions.map((p) => [p.deviceId, p]));
      setDevices(
        devs.map((d) => {
          const pos = posMap.get(d.id);
          return {
            ...d,
            position: pos,
            speedKmh: pos ? knotsToKmh(pos.speed) : 0,
            coords: {
              latitude: pos?.latitude ?? 30.3753,
              longitude: pos?.longitude ?? 69.3451,
            },
            angle: pos?.course ?? 0,
          };
        })
      );
      setError(null);
    } catch (e) {
      setError('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return { devices, loading, error, refresh: poll };
};
```

- [ ] **Step 2: Create `mobile/hooks/useMapRoute.ts`**

```typescript
import { useState } from 'react';
import { getLocationHistory } from '../services/traccarService';
import type { TraccarPosition } from '../types/traccar';
import { knotsToKmh } from '../types/traccar';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  speedKmh: number;
  fixTime: string;
}

export const useMapRoute = () => {
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoute = async (deviceId: number, from: Date, to: Date) => {
    setLoading(true);
    setError(null);
    try {
      const positions = await getLocationHistory(deviceId, from, to);
      setRoute(
        positions.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          speedKmh: knotsToKmh(p.speed),
          fixTime: p.fixTime,
        }))
      );
    } catch {
      setError('Failed to load route');
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => setRoute([]);

  return { route, loading, error, loadRoute, clearRoute };
};
```

- [ ] **Step 3: Commit**

```powershell
cd ..
git add mobile/hooks/
git commit -m "feat(mobile): add useFleetPolling and useMapRoute hooks"
```

---

## Task 7: Shared UI components

**Files:**
- Create: `mobile/components/VehicleMarker.tsx`
- Create: `mobile/components/StatCard.tsx`
- Create: `mobile/components/AlertItem.tsx`
- Create: `mobile/components/TripRow.tsx`
- Create: `mobile/components/SpeedOverlay.tsx`

- [ ] **Step 1: Create `mobile/components/VehicleMarker.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';

const blueIcon = require('../assets/icon_blue.png');
const grayIcon = require('../assets/icon_gray.png');

interface Props {
  coordinate: { latitude: number; longitude: number };
  rotation: number;
  selected?: boolean;
  speeding?: boolean;
  onPress?: () => void;
}

const SpeedingDot = () => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.speedingDot, { opacity }]} />
  );
};

const VehicleMarker = ({ coordinate, rotation, selected = false, speeding = false, onPress }: Props) => (
  <Marker
    coordinate={coordinate}
    rotation={rotation}
    anchor={{ x: 0.5, y: 0.5 }}
    onPress={onPress}
    tracksViewChanges={speeding}
  >
    <View style={styles.markerContainer}>
      <Image
        source={selected ? blueIcon : grayIcon}
        style={styles.carIcon}
        resizeMode="contain"
      />
      {speeding && <SpeedingDot />}
    </View>
  </Marker>
);

const styles = StyleSheet.create({
  markerContainer: { width: 40, height: 40 },
  carIcon: { width: 40, height: 40 },
  speedingDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default VehicleMarker;
```

- [ ] **Step 2: Create `mobile/components/StatCard.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  value: string | number;
  color?: string;
  unit?: string;
}

const StatCard = ({ label, value, color, unit }: Props) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, color ? { color } : null]}>
      {value}{unit ? <Text style={styles.unit}> {unit}</Text> : null}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#0f1b2d',
    borderWidth: 1,
    borderColor: '#1e3050',
    borderRadius: 10,
    padding: 12,
    margin: 4,
  },
  label: {
    color: '#7a93b4',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    color: '#e2eaf6',
    fontSize: 22,
    fontWeight: '700',
  },
  unit: {
    fontSize: 13,
    fontWeight: '400',
    color: '#7a93b4',
  },
});

export default StatCard;
```

- [ ] **Step 3: Create `mobile/components/AlertItem.tsx`**

```tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

type Severity = 'danger' | 'warning' | 'info';

interface Props {
  severity: Severity;
  title: string;
  detail: string;
  timestamp: string;
  onPress?: () => void;
}

const COLORS: Record<Severity, { bg: string; border: string; text: string }> = {
  danger: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
  warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
  info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
};

const AlertItem = ({ severity, title, detail, timestamp, onPress }: Props) => {
  const c = COLORS[severity];
  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: c.bg, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
      <Text style={styles.time}>{timestamp}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  title: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  detail: { color: '#e2eaf6', fontSize: 13, marginBottom: 2 },
  time: { color: '#7a93b4', fontSize: 11 },
});

export default AlertItem;
```

- [ ] **Step 4: Create `mobile/components/TripRow.tsx`**

```tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { metersToKm, knotsToKmh, msDuration } from '../types/traccar';
import type { TraccarTrip } from '../types/traccar';

interface Props {
  trip: TraccarTrip;
  onPress?: () => void;
}

const TripRow = ({ trip, onPress }: Props) => (
  <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.row}>
      <Text style={styles.device}>{trip.deviceName}</Text>
      <Text style={styles.distance}>{metersToKm(trip.distance).toFixed(1)} km</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.time}>
        {format(new Date(trip.startTime), 'dd MMM, HH:mm')} → {format(new Date(trip.endTime), 'HH:mm')}
      </Text>
      <Text style={styles.meta}>{msDuration(trip.duration)} · max {knotsToKmh(trip.maxSpeed).toFixed(0)} km/h</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f1b2d',
    borderWidth: 1,
    borderColor: '#1e3050',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  device: { color: '#e2eaf6', fontSize: 13, fontWeight: '600' },
  distance: { color: '#3b82f6', fontSize: 13, fontWeight: '700' },
  time: { color: '#7a93b4', fontSize: 11 },
  meta: { color: '#7a93b4', fontSize: 11 },
});

export default TripRow;
```

- [ ] **Step 5: Create `mobile/components/SpeedOverlay.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  speedKmh: number;
  limitKmh: number;
}

const SpeedOverlay = ({ speedKmh, limitKmh }: Props) => {
  const speeding = speedKmh > limitKmh;
  return (
    <View style={[styles.container, speeding && styles.speeding]}>
      <Text style={styles.speed}>{Math.round(speedKmh)}</Text>
      <Text style={styles.unit}>km/h</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    backgroundColor: 'rgba(8,15,30,0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e3050',
    padding: 10,
    alignItems: 'center',
    minWidth: 64,
  },
  speeding: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  speed: { color: '#e2eaf6', fontSize: 26, fontWeight: '700', lineHeight: 28 },
  unit: { color: '#7a93b4', fontSize: 11 },
});

export default SpeedOverlay;
```

- [ ] **Step 6: Type-check and commit**

```powershell
cd mobile && npx tsc --noEmit
cd ..
git add mobile/components/
git commit -m "feat(mobile): add VehicleMarker, StatCard, AlertItem, TripRow, SpeedOverlay components"
```

---

## Task 8: Login screen + root layout

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/index.tsx` → replace with redirect
- Create: `mobile/app/login.tsx`

- [ ] **Step 1: Update `mobile/app/_layout.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { loadCredentials, verifySession, loadRole } from '../services/authService';
import { setCredentials } from '../services/traccarService';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const creds = await loadCredentials();
      if (creds) {
        setCredentials(creds);
        const role = await verifySession(creds);
        if (role === 'admin' || role === 'fleet_manager') {
          router.replace('/(manager)/map');
        } else if (role === 'driver') {
          router.replace('/(driver)/map');
        } else {
          router.replace('/login');
        }
      } else {
        router.replace('/login');
      }
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080f1e' }}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Replace `mobile/app/index.tsx`**

```tsx
import { Redirect } from 'expo-router';
export default function Index() {
  return <Redirect href="/login" />;
}
```

- [ ] **Step 3: Create `mobile/app/login.tsx`**

```tsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../services/authService';
import { setCredentials } from '../services/traccarService';

export default function LoginScreen() {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState(process.env.EXPO_PUBLIC_TRACCAR_URL ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!serverUrl.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { role } = await login(serverUrl.trim(), email.trim(), password);
      setCredentials({ serverUrl: serverUrl.trim(), email: email.trim(), password });
      if (role === 'admin' || role === 'fleet_manager') {
        router.replace('/(manager)/map');
      } else {
        router.replace('/(driver)/map');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>TrackMe</Text>
        <Text style={styles.subtitle}>Fleet Management</Text>

        {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

        <Text style={styles.label}>SERVER URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://your-traccar-server.com"
          placeholderTextColor="#3d5470"
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor="#3d5470"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#3d5470"
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { color: '#e2eaf6', fontSize: 36, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#7a93b4', fontSize: 14, textAlign: 'center', marginBottom: 40 },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#ef4444', fontSize: 13 },
  label: { color: '#7a93b4', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#162236', borderWidth: 1, borderColor: '#1e3050', borderRadius: 8, padding: 14, color: '#e2eaf6', fontSize: 15, marginBottom: 16 },
  button: { backgroundColor: '#3b82f6', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 4: Test login flow**

Run `npx expo start` in `mobile/`. Login screen should appear. With demo2.traccar.org credentials it should authenticate and redirect.

- [ ] **Step 5: Commit**

```powershell
git add mobile/app/
git commit -m "feat(mobile): add login screen and root layout with role-based redirect"
```

---

## Task 9: Manager tab layout + Map screen

**Files:**
- Create: `mobile/app/(manager)/_layout.tsx`
- Create: `mobile/app/(manager)/map.tsx`

- [ ] **Step 1: Create `mobile/app/(manager)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ManagerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#080f1e', borderTopColor: '#1e3050' },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#7a93b4',
      }}
    >
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} /> }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }} />
    </Tabs>
  );
}
```

Add `@expo/vector-icons` (included with Expo):
```powershell
cd mobile && npx expo install @expo/vector-icons
```

- [ ] **Step 2: Create `mobile/app/(manager)/map.tsx`**

```tsx
import { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, FlatList, Pressable } from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFleetPolling } from '../../hooks/useFleetPolling';
import VehicleMarker from '../../components/VehicleMarker';
import type { DeviceWithPosition } from '../../hooks/useFleetPolling';

const SPEED_LIMIT = 120;

const parseCircleWKT = (area: string) => {
  const m = area.match(/CIRCLE\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([\d.]+)\s*\)/i);
  if (!m) return null;
  return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]), radius: parseFloat(m[3]) };
};

export default function ManagerMapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { devices, loading } = useFleetPolling();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');

  const handleDevicePress = (device: DeviceWithPosition) => {
    setSelectedId(device.id);
    mapRef.current?.animateToRegion({
      latitude: device.coords.latitude,
      longitude: device.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
  };

  const initialRegion = devices[0]
    ? { latitude: devices[0].coords.latitude, longitude: devices[0].coords.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }
    : { latitude: 30.3753, longitude: 69.3451, latitudeDelta: 8, longitudeDelta: 8 };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Map type toggle */}
      <View style={styles.mapTypeToggle}>
        {(['standard', 'satellite'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.mapTypeBtn, mapType === t && styles.mapTypeBtnActive]}
            onPress={() => setMapType(t)}
          >
            <Text style={[styles.mapTypeTxt, mapType === t && styles.mapTypeTxtActive]}>
              {t === 'standard' ? 'Street' : 'Satellite'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={mapType}
        initialRegion={initialRegion}
        showsUserLocation={false}
      >
        {devices.map((device) => (
          <VehicleMarker
            key={device.id}
            coordinate={device.coords}
            rotation={device.angle}
            selected={device.id === selectedId}
            speeding={device.speedKmh > SPEED_LIMIT && device.status === 'online'}
            onPress={() => handleDevicePress(device)}
          />
        ))}
      </MapView>

      {/* Device list strip */}
      <View style={styles.deviceList}>
        <FlatList
          data={devices}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={{ paddingHorizontal: 8 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.deviceChip, item.id === selectedId && styles.deviceChipSelected]}
              onPress={() => handleDevicePress(item)}
            >
              <View style={[styles.statusDot, { backgroundColor: item.status === 'online' ? '#22c55e' : '#6b7280' }]} />
              <Text style={styles.deviceName}>{item.name}</Text>
              {item.status === 'online' && (
                <Text style={[styles.deviceSpeed, item.speedKmh > SPEED_LIMIT && styles.speeding]}>
                  {Math.round(item.speedKmh)} km/h
                </Text>
              )}
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  map: { flex: 1 },
  mapTypeToggle: { position: 'absolute', top: 60, right: 12, zIndex: 10, flexDirection: 'row', backgroundColor: '#0f1b2d', borderRadius: 8, borderWidth: 1, borderColor: '#1e3050', overflow: 'hidden' },
  mapTypeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  mapTypeBtnActive: { backgroundColor: '#3b82f6' },
  mapTypeTxt: { color: '#7a93b4', fontSize: 12 },
  mapTypeTxtActive: { color: '#fff', fontWeight: '600' },
  deviceList: { position: 'absolute', bottom: 80, left: 0, right: 0 },
  deviceChip: { backgroundColor: '#0f1b2d', borderWidth: 1, borderColor: '#1e3050', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  deviceChipSelected: { borderColor: '#3b82f6', backgroundColor: '#162236' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  deviceName: { color: '#e2eaf6', fontSize: 12, fontWeight: '600' },
  deviceSpeed: { color: '#7a93b4', fontSize: 11 },
  speeding: { color: '#ef4444', fontWeight: '700' },
});
```

- [ ] **Step 3: Type-check and verify**

```powershell
cd mobile && npx tsc --noEmit && npx expo start
```
Expected: Map shows with device chips at bottom, markers render when connected to Traccar.

- [ ] **Step 4: Commit**

```powershell
cd ..
git add mobile/app/(manager)/
git commit -m "feat(mobile): manager tab layout + live fleet map with vehicle markers"
```

---

## Task 10: Manager Dashboard + Alerts screens

**Files:**
- Create: `mobile/app/(manager)/dashboard.tsx`
- Create: `mobile/app/(manager)/alerts.tsx`

- [ ] **Step 1: Create `mobile/app/(manager)/dashboard.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { getDevices, getSummary } from '../../services/traccarService';
import StatCard from '../../components/StatCard';
import { metersToKm, knotsToKmh } from '../../types/traccar';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [totalDevices, setTotalDevices] = useState(0);
  const [online, setOnline] = useState(0);
  const [offline, setOffline] = useState(0);
  const [todayDistance, setTodayDistance] = useState(0);

  const load = async () => {
    const devices = await getDevices();
    setTotalDevices(devices.length);
    setOnline(devices.filter((d) => d.status === 'online').length);
    setOffline(devices.filter((d) => d.status === 'offline').length);
    const now = new Date();
    const summaries = await getSummary(startOfDay(now), endOfDay(now)) as { distance?: number }[];
    setTodayDistance(summaries.reduce((s, r) => s + (r.distance ?? 0), 0));
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
    >
      <Text style={styles.title}>Fleet Dashboard</Text>
      <View style={styles.row}>
        <StatCard label="Total Devices" value={totalDevices} color="#3b82f6" />
        <StatCard label="Online" value={online} color="#22c55e" />
        <StatCard label="Offline" value={offline} color="#ef4444" />
      </View>
      <View style={styles.row}>
        <StatCard label="Today's Distance" value={metersToKm(todayDistance).toFixed(1)} unit="km" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e', padding: 16 },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  row: { flexDirection: 'row', marginBottom: 8 },
});
```

- [ ] **Step 2: Create `mobile/app/(manager)/alerts.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subDays } from 'date-fns';
import { getDevices, getEvents } from '../../services/traccarService';
import AlertItem from '../../components/AlertItem';
import { knotsToKmh } from '../../types/traccar';

interface Alert {
  id: string;
  severity: 'danger' | 'warning' | 'info';
  title: string;
  detail: string;
  timestamp: string;
}

const EVENT_SEVERITY: Record<string, 'danger' | 'warning' | 'info'> = {
  deviceOverspeed: 'danger',
  geofenceEnter: 'warning',
  geofenceExit: 'warning',
  deviceStopped: 'info',
  deviceMoving: 'info',
};

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const devices = await getDevices();
    const now = new Date();
    const from = subDays(now, 1);
    const all: Alert[] = [];
    for (const device of devices) {
      const events = await getEvents(device.id, from, now);
      for (const evt of events) {
        all.push({
          id: String(evt.id),
          severity: EVENT_SEVERITY[evt.type] ?? 'info',
          title: `${evt.type.replace(/([A-Z])/g, ' $1').trim()} — ${device.name}`,
          detail: `Device: ${device.name}`,
          timestamp: new Date(evt.eventTime).toLocaleTimeString(),
        });
      }
    }
    setAlerts(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 50));
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Alerts</Text>
      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        ListEmptyComponent={<Text style={styles.empty}>No alerts in the last 24 hours</Text>}
        renderItem={({ item }) => (
          <AlertItem severity={item.severity} title={item.title} detail={item.detail} timestamp={item.timestamp} />
        )}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 12 },
  empty: { color: '#7a93b4', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
```

- [ ] **Step 3: Commit**

```powershell
cd ..
git add mobile/app/(manager)/dashboard.tsx mobile/app/(manager)/alerts.tsx
git commit -m "feat(mobile): manager dashboard KPI cards + alerts screen"
```

---

## Task 11: Manager Trips screen

**Files:**
- Create: `mobile/app/(manager)/trips.tsx`

- [ ] **Step 1: Create `mobile/app/(manager)/trips.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { getDevices, getTrips } from '../../services/traccarService';
import { useMapRoute } from '../../hooks/useMapRoute';
import TripRow from '../../components/TripRow';
import type { TraccarTrip } from '../../types/traccar';

type Preset = 'today' | 'week' | 'month';

const getRange = (p: Preset) => {
  const now = new Date();
  if (p === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (p === 'week') return { from: subDays(now, 7), to: now };
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
};

export default function ManagerTripsScreen() {
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<Preset>('today');
  const [trips, setTrips] = useState<TraccarTrip[]>([]);
  const [replayTrip, setReplayTrip] = useState<TraccarTrip | null>(null);
  const { route, loadRoute, clearRoute } = useMapRoute();

  useEffect(() => {
    (async () => {
      const devices = await getDevices();
      const { from, to } = getRange(preset);
      const all: TraccarTrip[] = [];
      for (const d of devices) {
        const t = await getTrips(d.id, from, to);
        all.push(...t.map((tr) => ({ ...tr, deviceName: d.name })));
      }
      setTrips(all.sort((a, b) => b.startTime.localeCompare(a.startTime)));
    })();
  }, [preset]);

  const openReplay = async (trip: TraccarTrip) => {
    setReplayTrip(trip);
    await loadRoute(trip.deviceId, new Date(trip.startTime), new Date(trip.endTime));
  };

  const closeReplay = () => { setReplayTrip(null); clearRoute(); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Trip History</Text>

      {/* Preset selector */}
      <View style={styles.presets}>
        {(['today', 'week', 'month'] as Preset[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.presetBtn, preset === p && styles.presetBtnActive]}
            onPress={() => setPreset(p)}
          >
            <Text style={[styles.presetTxt, preset === p && styles.presetTxtActive]}>
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={trips}
        keyExtractor={(t) => `${t.deviceId}-${t.startTime}`}
        ListEmptyComponent={<Text style={styles.empty}>No trips for this period</Text>}
        renderItem={({ item }) => (
          <TripRow trip={item} onPress={() => openReplay(item)} />
        )}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
      />

      {/* Route replay modal */}
      <Modal visible={!!replayTrip} animationType="slide" onRequestClose={closeReplay}>
        <View style={{ flex: 1, backgroundColor: '#080f1e' }}>
          <TouchableOpacity style={styles.closeBtn} onPress={closeReplay}>
            <Text style={styles.closeTxt}>✕ Close</Text>
          </TouchableOpacity>
          {replayTrip && route.length > 0 && (
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude: replayTrip.startLat,
                longitude: replayTrip.startLon,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              <Polyline
                coordinates={route.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
                strokeColor="#3b82f6"
                strokeWidth={3}
              />
              <Marker coordinate={{ latitude: replayTrip.startLat, longitude: replayTrip.startLon }} pinColor="green" title="Start" />
              <Marker coordinate={{ latitude: replayTrip.endLat, longitude: replayTrip.endLon }} pinColor="red" title="End" />
            </MapView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 8 },
  presets: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  presetBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#1e3050' },
  presetBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  presetTxt: { color: '#7a93b4', fontSize: 13 },
  presetTxtActive: { color: '#fff', fontWeight: '600' },
  empty: { color: '#7a93b4', textAlign: 'center', marginTop: 40 },
  closeBtn: { padding: 16 },
  closeTxt: { color: '#3b82f6', fontSize: 16 },
});
```

- [ ] **Step 2: Commit**

```powershell
cd ..
git add mobile/app/(manager)/trips.tsx
git commit -m "feat(mobile): manager trips screen with route replay"
```

---

## Task 12: Manager Settings screen

**Files:**
- Create: `mobile/app/(manager)/settings.tsx`

- [ ] **Step 1: Create `mobile/app/(manager)/settings.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadCredentials, clearCredentials } from '../../services/authService';

export default function ManagerSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState('');
  const [email, setEmail] = useState('');
  const [speedLimit, setSpeedLimit] = useState('120');

  useEffect(() => {
    (async () => {
      const creds = await loadCredentials();
      if (creds) { setServerUrl(creds.serverUrl); setEmail(creds.email); }
      const sl = await AsyncStorage.getItem('trackme_speed_limit');
      if (sl) setSpeedLimit(sl);
    })();
  }, []);

  const saveSpeedLimit = async () => {
    await AsyncStorage.setItem('trackme_speed_limit', speedLimit);
  };

  const handleDisconnect = async () => {
    await clearCredentials();
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.row}><Text style={styles.key}>Server</Text><Text style={styles.value}>{serverUrl}</Text></View>
        <View style={styles.row}><Text style={styles.key}>Email</Text><Text style={styles.value}>{email}</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SPEED LIMIT (km/h)</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={speedLimit}
            onChangeText={setSpeedLimit}
            keyboardType="numeric"
            onEndEditing={saveSpeedLimit}
          />
          <Text style={styles.inputUnit}>km/h</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
        <Text style={styles.disconnectTxt}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e', padding: 16 },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  section: { backgroundColor: '#0f1b2d', borderWidth: 1, borderColor: '#1e3050', borderRadius: 10, padding: 16, marginBottom: 16 },
  sectionLabel: { color: '#7a93b4', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#162236' },
  key: { color: '#7a93b4', fontSize: 14 },
  value: { color: '#e2eaf6', fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: '#162236', borderWidth: 1, borderColor: '#1e3050', borderRadius: 8, padding: 10, color: '#e2eaf6', fontSize: 16, width: 80, textAlign: 'center' },
  inputUnit: { color: '#7a93b4', fontSize: 14 },
  disconnectBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  disconnectTxt: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```powershell
cd ..
git add mobile/app/(manager)/settings.tsx
git commit -m "feat(mobile): manager settings screen"
```

---

## Task 13: Driver tab layout + Map + Vehicles screens

**Files:**
- Create: `mobile/app/(driver)/_layout.tsx`
- Create: `mobile/app/(driver)/map.tsx`
- Create: `mobile/app/(driver)/vehicles.tsx`

- [ ] **Step 1: Create `mobile/app/(driver)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#080f1e', borderTopColor: '#1e3050' },
        tabBarActiveTintColor: '#8b5cf6',
        tabBarInactiveTintColor: '#7a93b4',
      }}
    >
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} /> }} />
      <Tabs.Screen name="vehicles" options={{ title: 'Vehicles', tabBarIcon: ({ color, size }) => <Ionicons name="car" size={size} color={color} /> }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }} />
      <Tabs.Screen name="log" options={{ title: 'Log', tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Create `mobile/app/(driver)/map.tsx`**

Same as manager map but with speed overlay. Copy manager map and add SpeedOverlay:

```tsx
import { useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFleetPolling } from '../../hooks/useFleetPolling';
import VehicleMarker from '../../components/VehicleMarker';
import SpeedOverlay from '../../components/SpeedOverlay';
import { useEffect } from 'react';

export default function DriverMapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { devices } = useFleetPolling();
  const [speedLimit, setSpeedLimit] = useState(120);

  useEffect(() => {
    AsyncStorage.getItem('trackme_speed_limit').then((sl) => {
      if (sl) setSpeedLimit(parseInt(sl, 10));
    });
  }, []);

  const primaryDevice = devices[0];

  const initialRegion = primaryDevice
    ? { latitude: primaryDevice.coords.latitude, longitude: primaryDevice.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 30.3753, longitude: 69.3451, latitudeDelta: 8, longitudeDelta: 8 };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>
        {devices.map((device) => (
          <VehicleMarker
            key={device.id}
            coordinate={device.coords}
            rotation={device.angle}
            selected
            speeding={device.speedKmh > speedLimit}
          />
        ))}
      </MapView>
      {primaryDevice && (
        <SpeedOverlay speedKmh={primaryDevice.speedKmh} limitKmh={speedLimit} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  map: { flex: 1 },
});
```

- [ ] **Step 3: Create `mobile/app/(driver)/vehicles.tsx`**

```tsx
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFleetPolling } from '../../hooks/useFleetPolling';
import StatCard from '../../components/StatCard';
import { knotsToKmh } from '../../types/traccar';

export default function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const { devices, loading } = useFleetPolling();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>My Vehicles ({devices.length})</Text>
      <FlatList
        data={devices}
        keyExtractor={(d) => String(d.id)}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading…' : 'No vehicles assigned'}</Text>}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftColor: item.status === 'online' ? '#22c55e' : '#6b7280' }]}>
            <View style={styles.cardHeader}>
              <View style={styles.nameRow}>
                <View style={[styles.dot, { backgroundColor: item.status === 'online' ? '#22c55e' : '#6b7280' }]} />
                <Text style={styles.name}>{item.name}</Text>
              </View>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            {item.status === 'online' && (
              <View style={styles.statsRow}>
                <StatCard label="Speed" value={Math.round(item.speedKmh)} unit="km/h" color="#3b82f6" />
                <StatCard label="Heading" value={`${item.angle}°`} />
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 8 },
  empty: { color: '#7a93b4', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#0f1b2d', borderWidth: 1, borderColor: '#1e3050', borderLeftWidth: 3, borderRadius: 10, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: '#e2eaf6', fontSize: 16, fontWeight: '600' },
  status: { color: '#7a93b4', fontSize: 12, textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row' },
});
```

- [ ] **Step 4: Commit**

```powershell
cd ..
git add mobile/app/(driver)/
git commit -m "feat(mobile): driver tab layout + map with speed overlay + vehicles screen"
```

---

## Task 14: Driver Trips screen + Log screen

**Files:**
- Create: `mobile/app/(driver)/trips.tsx`
- Create: `mobile/app/(driver)/log.tsx`

- [ ] **Step 1: Create `mobile/app/(driver)/trips.tsx`**

Identical to manager trips but uses the same scoped Traccar API (driver only sees their devices automatically):

```tsx
import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { getDevices, getTrips } from '../../services/traccarService';
import { useMapRoute } from '../../hooks/useMapRoute';
import TripRow from '../../components/TripRow';
import type { TraccarTrip } from '../../types/traccar';

type Preset = 'today' | 'week' | 'month';
const getRange = (p: Preset) => {
  const now = new Date();
  if (p === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (p === 'week') return { from: subDays(now, 7), to: now };
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
};

export default function DriverTripsScreen() {
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<Preset>('today');
  const [trips, setTrips] = useState<TraccarTrip[]>([]);
  const [replayTrip, setReplayTrip] = useState<TraccarTrip | null>(null);
  const { route, loadRoute, clearRoute } = useMapRoute();

  useEffect(() => {
    (async () => {
      const devices = await getDevices();
      const { from, to } = getRange(preset);
      const all: TraccarTrip[] = [];
      for (const d of devices) {
        const t = await getTrips(d.id, from, to);
        all.push(...t.map((tr) => ({ ...tr, deviceName: d.name })));
      }
      setTrips(all.sort((a, b) => b.startTime.localeCompare(a.startTime)));
    })();
  }, [preset]);

  const openReplay = async (trip: TraccarTrip) => {
    setReplayTrip(trip);
    await loadRoute(trip.deviceId, new Date(trip.startTime), new Date(trip.endTime));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>My Trips</Text>
      <View style={styles.presets}>
        {(['today', 'week', 'month'] as Preset[]).map((p) => (
          <TouchableOpacity key={p} style={[styles.presetBtn, preset === p && styles.presetBtnActive]} onPress={() => setPreset(p)}>
            <Text style={[styles.presetTxt, preset === p && styles.presetTxtActive]}>{p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={trips}
        keyExtractor={(t) => `${t.deviceId}-${t.startTime}`}
        ListEmptyComponent={<Text style={styles.empty}>No trips for this period</Text>}
        renderItem={({ item }) => <TripRow trip={item} onPress={() => openReplay(item)} />}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
      />
      <Modal visible={!!replayTrip} animationType="slide" onRequestClose={() => { setReplayTrip(null); clearRoute(); }}>
        <View style={{ flex: 1, backgroundColor: '#080f1e' }}>
          <TouchableOpacity style={{ padding: 16 }} onPress={() => { setReplayTrip(null); clearRoute(); }}>
            <Text style={{ color: '#8b5cf6', fontSize: 16 }}>✕ Close</Text>
          </TouchableOpacity>
          {replayTrip && route.length > 0 && (
            <MapView style={{ flex: 1 }} initialRegion={{ latitude: replayTrip.startLat, longitude: replayTrip.startLon, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
              <Polyline coordinates={route.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))} strokeColor="#8b5cf6" strokeWidth={3} />
              <Marker coordinate={{ latitude: replayTrip.startLat, longitude: replayTrip.startLon }} pinColor="green" />
              <Marker coordinate={{ latitude: replayTrip.endLat, longitude: replayTrip.endLon }} pinColor="red" />
            </MapView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 8 },
  presets: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  presetBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#1e3050' },
  presetBtnActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  presetTxt: { color: '#7a93b4', fontSize: 13 },
  presetTxtActive: { color: '#fff', fontWeight: '600' },
  empty: { color: '#7a93b4', textAlign: 'center', marginTop: 40 },
});
```

- [ ] **Step 2: Create `mobile/app/(driver)/log.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDevices } from '../../services/traccarService';
import { createFuelEntry, getAllFuelEntries } from '../../services/fuelService';
import { createExpense, getAllExpenses } from '../../services/expenseService';
import { EXPENSE_CATEGORIES, formatCurrency } from '../../types/local';
import type { FuelEntry, ExpenseEntry, ExpenseCategory } from '../../types/local';
import type { TraccarDevice } from '../../types/traccar';
import { format } from 'date-fns';

type Tab = 'fuel' | 'expense';

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('fuel');
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');

  // Fuel form
  const [liters, setLiters] = useState('');
  const [costPerLiter, setCostPerLiter] = useState('');
  const [odometer, setOdometer] = useState('');
  const [fuelNotes, setFuelNotes] = useState('');
  const [recentFuel, setRecentFuel] = useState<FuelEntry[]>([]);

  // Expense form
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Toll');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [recentExpenses, setRecentExpenses] = useState<ExpenseEntry[]>([]);

  useEffect(() => {
    (async () => {
      const devs = await getDevices();
      setDevices(devs);
      if (devs.length > 0) setSelectedDevice(String(devs[0].id));
      setRecentFuel((await getAllFuelEntries()).slice(0, 5));
      setRecentExpenses((await getAllExpenses()).slice(0, 5));
    })();
  }, []);

  const saveFuel = async () => {
    if (!liters || !costPerLiter || !odometer) { Alert.alert('Missing fields', 'Fill in liters, cost, and odometer.'); return; }
    await createFuelEntry({
      deviceId: selectedDevice,
      date: format(new Date(), 'yyyy-MM-dd'),
      liters: parseFloat(liters),
      costPerLiter: parseFloat(costPerLiter),
      odometer: parseFloat(odometer),
      notes: fuelNotes,
    });
    setLiters(''); setCostPerLiter(''); setOdometer(''); setFuelNotes('');
    setRecentFuel((await getAllFuelEntries()).slice(0, 5));
    Alert.alert('Saved', 'Fill-up logged.');
  };

  const saveExpense = async () => {
    if (!amount) { Alert.alert('Missing fields', 'Enter an amount.'); return; }
    await createExpense({
      deviceId: selectedDevice,
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: parseFloat(amount),
      category,
      description: category,
      notes: expenseNotes,
    });
    setAmount(''); setExpenseNotes('');
    setRecentExpenses((await getAllExpenses()).slice(0, 5));
    Alert.alert('Saved', 'Expense logged.');
  };

  const totalCostPreview = liters && costPerLiter
    ? parseFloat(liters) * parseFloat(costPerLiter)
    : null;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Log Entry</Text>

      {/* Tab selector */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'fuel' && styles.tabActive]} onPress={() => setTab('fuel')}>
          <Text style={[styles.tabTxt, tab === 'fuel' && styles.tabTxtActive]}>⛽ Fuel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'expense' && styles.tabActive]} onPress={() => setTab('expense')}>
          <Text style={[styles.tabTxt, tab === 'expense' && styles.tabTxtActive]}>💰 Expense</Text>
        </TouchableOpacity>
      </View>

      {/* Vehicle selector */}
      <Text style={styles.label}>VEHICLE</Text>
      <View style={styles.deviceRow}>
        {devices.map((d) => (
          <TouchableOpacity
            key={d.id}
            style={[styles.deviceChip, selectedDevice === String(d.id) && styles.deviceChipActive]}
            onPress={() => setSelectedDevice(String(d.id))}
          >
            <Text style={[styles.deviceChipTxt, selectedDevice === String(d.id) && styles.deviceChipTxtActive]}>{d.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'fuel' ? (
        <View style={styles.form}>
          <Text style={styles.label}>LITERS</Text>
          <TextInput style={styles.input} value={liters} onChangeText={setLiters} keyboardType="decimal-pad" placeholder="45.5" placeholderTextColor="#3d5470" />

          <Text style={styles.label}>COST PER LITER (Rs.)</Text>
          <TextInput style={styles.input} value={costPerLiter} onChangeText={setCostPerLiter} keyboardType="decimal-pad" placeholder="290.00" placeholderTextColor="#3d5470" />

          <Text style={styles.label}>ODOMETER (km)</Text>
          <TextInput style={styles.input} value={odometer} onChangeText={setOdometer} keyboardType="decimal-pad" placeholder="28450" placeholderTextColor="#3d5470" />

          <Text style={styles.label}>NOTES (optional)</Text>
          <TextInput style={styles.input} value={fuelNotes} onChangeText={setFuelNotes} placeholder="Petrol station name..." placeholderTextColor="#3d5470" />

          <TouchableOpacity style={styles.saveBtn} onPress={saveFuel}>
            <Text style={styles.saveTxt}>
              Save Fill-Up{totalCostPreview ? ` • ${formatCurrency(totalCostPreview)}` : ''}
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionHeader}>Recent Fill-Ups</Text>
          {recentFuel.map((e) => (
            <View key={e.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{e.date}</Text>
              <Text style={styles.historyValue}>{e.liters}L</Text>
              <Text style={styles.historyValue}>{formatCurrency(e.totalCost)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {EXPENSE_CATEGORIES.map((c) => (
              <TouchableOpacity key={c} style={[styles.catChip, category === c && styles.catChipActive]} onPress={() => setCategory(c)}>
                <Text style={[styles.catTxt, category === c && styles.catTxtActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>AMOUNT (Rs.)</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="500.00" placeholderTextColor="#3d5470" />

          <Text style={styles.label}>NOTES (optional)</Text>
          <TextInput style={styles.input} value={expenseNotes} onChangeText={setExpenseNotes} placeholder="Details..." placeholderTextColor="#3d5470" />

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#8b5cf6' }]} onPress={saveExpense}>
            <Text style={styles.saveTxt}>Save Expense{amount ? ` • ${formatCurrency(parseFloat(amount) || 0)}` : ''}</Text>
          </TouchableOpacity>

          <Text style={styles.sectionHeader}>Recent Expenses</Text>
          {recentExpenses.map((e) => (
            <View key={e.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{e.date}</Text>
              <Text style={styles.historyValue}>{e.category}</Text>
              <Text style={styles.historyValue}>{formatCurrency(e.amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 8 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#0f1b2d', borderRadius: 10, borderWidth: 1, borderColor: '#1e3050', marginBottom: 16, overflow: 'hidden' },
  tab: { flex: 1, padding: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#162236' },
  tabTxt: { color: '#7a93b4', fontSize: 14, fontWeight: '600' },
  tabTxtActive: { color: '#e2eaf6' },
  label: { color: '#7a93b4', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginHorizontal: 16 },
  deviceRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  deviceChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#1e3050', backgroundColor: '#0f1b2d' },
  deviceChipActive: { borderColor: '#3b82f6', backgroundColor: '#162236' },
  deviceChipTxt: { color: '#7a93b4', fontSize: 13 },
  deviceChipTxtActive: { color: '#3b82f6', fontWeight: '600' },
  form: { paddingHorizontal: 16 },
  input: { backgroundColor: '#162236', borderWidth: 1, borderColor: '#1e3050', borderRadius: 8, padding: 14, color: '#e2eaf6', fontSize: 15, marginBottom: 16 },
  saveBtn: { backgroundColor: '#22c55e', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 24 },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionHeader: { color: '#7a93b4', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#162236' },
  historyDate: { color: '#7a93b4', fontSize: 12, flex: 1 },
  historyValue: { color: '#e2eaf6', fontSize: 13, marginLeft: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#1e3050', backgroundColor: '#0f1b2d', marginRight: 8 },
  catChipActive: { borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.15)' },
  catTxt: { color: '#7a93b4', fontSize: 13 },
  catTxtActive: { color: '#8b5cf6', fontWeight: '600' },
});
```

- [ ] **Step 3: Commit**

```powershell
cd ..
git add mobile/app/(driver)/trips.tsx mobile/app/(driver)/log.tsx
git commit -m "feat(mobile): driver trips screen + fuel/expense log screen"
```

---

## Task 15: Driver Settings + Push notifications

**Files:**
- Create: `mobile/app/(driver)/settings.tsx`
- Create: `mobile/services/notificationService.ts`

- [ ] **Step 1: Create `mobile/app/(driver)/settings.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadCredentials, clearCredentials } from '../../services/authService';

export default function DriverSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmailState] = useState('');
  const [speedLimit, setSpeedLimit] = useState('120');

  useEffect(() => {
    (async () => {
      const creds = await loadCredentials();
      if (creds) setEmailState(creds.email);
      const sl = await AsyncStorage.getItem('trackme_speed_limit');
      if (sl) setSpeedLimit(sl);
    })();
  }, []);

  const saveSpeedLimit = () => AsyncStorage.setItem('trackme_speed_limit', speedLimit);

  const handleDisconnect = async () => {
    await clearCredentials();
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.row}><Text style={styles.key}>Email</Text><Text style={styles.value}>{email}</Text></View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SPEED ALERT (km/h)</Text>
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={speedLimit} onChangeText={setSpeedLimit} keyboardType="numeric" onEndEditing={saveSpeedLimit} />
          <Text style={styles.inputUnit}>km/h — visual warning on map</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
        <Text style={styles.disconnectTxt}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e', padding: 16 },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  section: { backgroundColor: '#0f1b2d', borderWidth: 1, borderColor: '#1e3050', borderRadius: 10, padding: 16, marginBottom: 16 },
  sectionLabel: { color: '#7a93b4', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  key: { color: '#7a93b4', fontSize: 14 },
  value: { color: '#e2eaf6', fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { backgroundColor: '#162236', borderWidth: 1, borderColor: '#1e3050', borderRadius: 8, padding: 10, color: '#e2eaf6', fontSize: 16, width: 80, textAlign: 'center' },
  inputUnit: { color: '#7a93b4', fontSize: 12, flex: 1 },
  disconnectBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 10, padding: 16, alignItems: 'center' },
  disconnectTxt: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: Create `mobile/services/notificationService.ts`**

```typescript
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const TOKEN_KEY = 'trackme_push_token';

export const registerForPushNotifications = async (): Promise<string | null> => {
  const existing = await AsyncStorage.getItem(TOKEN_KEY);
  if (existing) return existing;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
};

export const sendLocalNotification = async (
  title: string,
  body: string
): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // immediate
  });
};

export const getPushToken = (): Promise<string | null> =>
  AsyncStorage.getItem(TOKEN_KEY);
```

- [ ] **Step 3: Commit**

```powershell
cd ..
git add mobile/app/(driver)/settings.tsx mobile/services/notificationService.ts
git commit -m "feat(mobile): driver settings screen + push notification service"
```

---

## Task 16: EAS build config + final type-check

**Files:**
- Create: `mobile/eas.json`

- [ ] **Step 1: Install EAS CLI**

```powershell
npm install -g eas-cli
```

- [ ] **Step 2: Create `mobile/eas.json`**

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 3: Final type-check**

```powershell
cd mobile && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Test on device**

```powershell
npx expo start
```
Scan QR with Expo Go app. Test login → verify role-based redirect → test map, trip history, fuel logging.

- [ ] **Step 5: Final commit**

```powershell
cd ..
git add mobile/eas.json
git commit -m "feat(mobile): EAS build config + complete TrackMe mobile app"
```
