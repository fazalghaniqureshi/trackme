# TrackMe Mobile App Design

**Date:** 2026-05-08  
**Status:** Approved — expanded with full feature set  
**Platform:** React Native + Expo (iOS + Android)  
**Location:** `trackme/mobile/` — subfolder of the existing web repo

---

## Overview

A role-aware mobile companion to the TrackMe web app. Reads the user's role (`admin`/`fleet_manager`/`driver`) from Traccar on login and shows role-appropriate navigation. No user management in the app — all user/role administration happens on the web.

---

## Role-Based Navigation

### Manager / Admin — 5 tabs

| Tab | Screen | Description |
|---|---|---|
| 🗺️ Map | `(manager)/map.tsx` | Live fleet map — all devices, car icons with rotation + speeding badge, geofence overlay |
| 📊 Dashboard | `(manager)/dashboard.tsx` | KPI cards + 7-day distance chart + online/offline device list |
| 📋 Trips | `(manager)/trips.tsx` | Trip history per vehicle — list + map replay |
| 🔔 Alerts | `(manager)/alerts.tsx` | Speeding, geofence breach, maintenance due, idle time |
| ⚙️ Settings | `(manager)/settings.tsx` | Server URL, account info, speed limit, disconnect |

### Driver — 5 tabs

| Tab | Screen | Description |
|---|---|---|
| 🗺️ Map | `(driver)/map.tsx` | Map showing only assigned vehicle(s), speed overlay, geofence circles |
| 🚗 Vehicles | `(driver)/vehicles.tsx` | Assigned vehicles: speed, status, distance today, live trip stats |
| 📋 Trips | `(driver)/trips.tsx` | Personal trip history — list + map replay |
| ➕ Log | `(driver)/log.tsx` | Quick-add: Fuel fill-up OR Expense (tab selector within screen) |
| ⚙️ Settings | `(driver)/settings.tsx` | Account info, speed alert threshold, disconnect |

---

## Screen Details

### Manager — Map (`(manager)/map.tsx`)
- `react-native-maps` MapView
- Device markers: `VehicleMarker` — `icon_gray.png` default, `icon_blue.png` selected, `rotation` prop for heading
- Speeding vehicles: pulsing red `Animated.View` overlay dot (matches web `.speeding-badge`)
- Geofence circles rendered from Traccar `/api/geofences` (CIRCLE WKT parsed, same as web)
- Tap device → bottom sheet with name, speed, address, "View Trips" button
- 5-second polling via `useFleetPolling` hook
- Map type toggle: Standard / Satellite (top-right corner)
- Speed limit setting badge (tappable → goes to Settings)

### Manager — Dashboard (`(manager)/dashboard.tsx`)
- StatCard row: Total Devices, Online, Offline, Today's Distance
- Fleet health row: Overdue Maintenance, Active Drivers, Fuel This Month
- 7-day distance bar chart (Recharts → use `react-native-chart-kit` or `victory-native`)
- Device status list with last seen timestamp
- Refresh every 30s

### Manager — Trips (`(manager)/trips.tsx`)
- Vehicle filter picker (all devices or specific)
- Date range selector (Today / This Week / This Month / Custom)
- Trip list: vehicle name, start→end time, distance, max speed
- Tap trip → full-screen map with route replay (polyline, start/end markers, speed colors)
- Route replay controls: Play/Pause, speed multiplier (1×/5×/10×)

### Manager — Alerts (`(manager)/alerts.tsx`)
- Grouped alert list: Critical (red) / Warning (amber) / Info (blue)
- Categories: Speeding, Geofence, Maintenance, Idle, Driver License
- Pull-to-refresh
- Tap alert → opens relevant screen (map for speeding, maintenance for service)
- Push notification badge count shown on tab

### Driver — Map (`(driver)/map.tsx`)
- Same as manager map but scoped to assigned devices only (Traccar enforces this)
- Speed display on map overlay (large current speed in km/h, bottom-left)
- Visual speed warning: map overlay turns red-tinted when over speed limit
- Geofence circles for geofences assigned to driver's devices

### Driver — Vehicles (`(driver)/vehicles.tsx`)
- List of assigned vehicles with card per vehicle:
  - Status dot (online/offline), name, current speed
  - Today's distance, engine status
  - Current trip section: duration, distance since ignition on
  - Maintenance due alerts for that vehicle
- Tap vehicle → detail screen with mini-map + trip history tab + maintenance tab

### Driver — Trips (`(driver)/trips.tsx`)
- Same as manager trips but filtered to driver's assigned devices automatically
- Includes current active trip (live stats: distance so far, duration, avg speed)

### Driver — Log (`(driver)/log.tsx`)
- Tab selector at top: **Fuel** | **Expense**
- **Fuel tab:** Vehicle selector, Liters, Cost/Liter (Rs.), Odometer, Notes → shows total cost preview → Save
- **Expense tab:** Vehicle selector, Category dropdown, Amount (Rs.), Date, Notes → Save
- Recent entries list at bottom (last 5 fuel / last 5 expenses)
- History button → full list screen

### Settings (both roles)
- Current server + logged-in email (read-only)
- Speed alert threshold (default 120 km/h)
- Push notification toggle
- App version
- Disconnect button (clears SecureStore + AsyncStorage → returns to login)

---

## Project Structure

```
trackme/
├── src/                              ← existing web app (unchanged)
└── mobile/                           ← new Expo app
    ├── app.json
    ├── package.json
    ├── tsconfig.json
    ├── .env                          ← EXPO_PUBLIC_TRACCAR_URL
    ├── app/
    │   ├── _layout.tsx               ← root: auth check → redirect by role
    │   ├── login.tsx
    │   ├── (manager)/
    │   │   ├── _layout.tsx           ← bottom tabs: Map/Dashboard/Trips/Alerts/Settings
    │   │   ├── map.tsx
    │   │   ├── dashboard.tsx
    │   │   ├── trips.tsx
    │   │   ├── alerts.tsx
    │   │   └── settings.tsx
    │   └── (driver)/
    │       ├── _layout.tsx           ← bottom tabs: Map/Vehicles/Trips/Log/Settings
    │       ├── map.tsx
    │       ├── vehicles.tsx
    │       ├── trips.tsx
    │       ├── log.tsx
    │       └── settings.tsx
    ├── services/
    │   ├── traccarService.ts         ← devices, positions, trips, events, geofences
    │   ├── authService.ts            ← login, SecureStore, role cache
    │   ├── fuelService.ts            ← AsyncStorage CRUD
    │   └── expenseService.ts         ← AsyncStorage CRUD
    ├── hooks/
    │   ├── useFleetPolling.ts        ← 5s device+position poll
    │   └── useMapRoute.ts            ← fetch + replay trip route
    ├── components/
    │   ├── VehicleMarker.tsx         ← car icon + rotation + speeding animation
    │   ├── StatCard.tsx              ← KPI card
    │   ├── AlertItem.tsx             ← alert row
    │   ├── TripRow.tsx               ← trip list item
    │   └── SpeedOverlay.tsx          ← driver speed display + warning
    ├── types/
    │   ├── traccar.ts                ← Device, Position, Trip, Event, Geofence types
    │   └── local.ts                  ← FuelEntry, ExpenseEntry, EXPENSE_CATEGORIES
    └── assets/
        ├── icon_blue.png             ← from web src/assets/images/
        └── icon_gray.png             ← from web src/assets/images/
```

---

## Authentication Flow

1. App launches → `_layout.tsx` checks `SecureStore` for `traccar_credentials`
2. If found → `GET /api/session` to verify → read `trackme_current_role` from `AsyncStorage`
3. Valid + role → redirect to `/(manager)` or `/(driver)`
4. Otherwise → `/login`
5. Login: `POST /api/session` (form-encoded) → on success `GET /api/session` → extract role from `user.admin` flag or `user.attributes.trackme_role` → save to `AsyncStorage` → redirect

**Direct API calls (no proxy):**
```typescript
const base = process.env.EXPO_PUBLIC_TRACCAR_URL; // e.g. https://my-traccar.com
const auth = btoa(`${email}:${password}`);
fetch(`${base}/api/devices`, {
  headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
});
```

---

## Vehicle Markers

**`VehicleMarker` component:**
```tsx
// Renders inside react-native-maps MapView
<Marker coordinate={coords} rotation={device.course} anchor={{ x: 0.5, y: 0.5 }}>
  <View style={{ width: 40, height: 40 }}>
    <Image source={selected ? blueIcon : grayIcon} style={{ width: 40, height: 40 }} />
    {speeding && <SpeedingDot />}  {/* Animated pulsing red dot, top-right */}
  </View>
</Marker>
```

`SpeedingDot` uses `Animated.loop(Animated.sequence([fadeOut, fadeIn]))` — matches web speeding badge.

---

## Push Notifications

**Expo Notifications library.**

- On first alert detected → `requestPermissionsAsync()` → `getExpoPushTokenAsync()`
- Token saved to `AsyncStorage` AND to Traccar user attributes (`PUT /api/users/{id}` with `attributes.expo_push_token`)
- **Foreground:** Local notification via `scheduleNotificationAsync` immediately on speeding/alert detection
- **Background:** Vercel serverless function `api/notify.ts` added to the existing Vercel project:
  - Traccar webhook (self-hosted) POSTs event to `https://trackme.vercel.app/api/notify`
  - Function fetches push token from Traccar user attributes
  - Calls Expo Push API (`https://exp.host/--/api/v2/push/send`)

---

## Trip Replay

1. Tap trip → fetch `GET /api/positions?deviceId=X&from=Y&to=Z`
2. Render polyline colored by speed (green→yellow→red, same as web)
3. Animated playhead marker moves along route
4. Speed multiplier: 1×/5×/10×/50×
5. Start/end markers (green circle → red circle)

---

## Local Data (AsyncStorage)

**Fuel entries:** `trackme_mobile_fuel` — same format as web `trackme_fuel`  
**Expense entries:** `trackme_mobile_expenses` — same format as web `trackme_expenses`  
**Role cache:** `trackme_current_role`  
**Speed limit:** `trackme_speed_limit` (default `"120"`)  
**Push token:** `trackme_push_token`

---

## Key Dependencies

```json
{
  "expo": "~52.0.0",
  "expo-router": "~4.0.0",
  "react-native-maps": "~1.18.0",
  "expo-secure-store": "~14.0.0",
  "expo-notifications": "~0.29.0",
  "@react-native-async-storage/async-storage": "~2.1.0",
  "react-native-safe-area-context": "4.12.0",
  "react-native-screens": "~4.4.0",
  "victory-native": "~41.0.0",
  "date-fns": "^4.1.0"
}
```

---

## Build & Distribution

```bash
cd mobile
npx expo start              # dev — Expo Go app on phone
npx expo start --ios        # iOS simulator (Mac only)
npx expo start --android    # Android emulator

eas build --platform android  # Production APK/AAB
eas build --platform ios      # Production IPA
eas submit --platform android # Upload to Play Store
eas submit --platform ios     # Upload to App Store
```

---

## Implementation Order

1. Scaffold Expo app in `mobile/` — install deps, configure Expo Router
2. Copy vehicle icon assets from web
3. Create `types/traccar.ts` + `types/local.ts`
4. Implement `authService.ts` — login, SecureStore, role detection
5. Implement `traccarService.ts` — devices, positions, trips, events, geofences
6. Implement `fuelService.ts` + `expenseService.ts` (AsyncStorage)
7. Implement `useFleetPolling` hook + `useMapRoute` hook
8. Build `VehicleMarker` + `SpeedingDot` component
9. Build `StatCard`, `AlertItem`, `TripRow`, `SpeedOverlay` components
10. Build Login screen + root `_layout.tsx` (auth redirect)
11. Build Manager bottom tab layout + Map screen
12. Build Manager Dashboard + Alerts screens
13. Build Manager Trips screen (list + replay)
14. Build Driver bottom tab layout + Map + Vehicles screens
15. Build Driver Trips screen + Log screen (Fuel + Expense tabs)
16. Build Settings screens (both roles)
17. Implement push notifications (local + Vercel webhook bridge `api/notify.ts`)
18. EAS build config (`eas.json`) + test on real device
