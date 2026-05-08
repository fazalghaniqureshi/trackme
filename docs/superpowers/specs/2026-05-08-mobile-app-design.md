# TrackMe Mobile App Design

**Date:** 2026-05-08  
**Status:** Approved  
**Platform:** React Native + Expo (iOS + Android)  
**Location:** `trackme/mobile/` — subfolder of the existing web repo

---

## Overview

A role-aware mobile companion to the TrackMe web app. Reads the user's role (`admin`/`fleet_manager`/`driver`) from Traccar on login and shows role-appropriate navigation. No user management in the app — all user/role administration happens on the web.

---

## Role-Based Navigation

### Manager / Admin
| Tab | Screen | Description |
|---|---|---|
| 🗺️ Map | `(manager)/map.tsx` | Live fleet map — all assigned devices, car icons with rotation + speeding badge |
| 📊 Dashboard | `(manager)/dashboard.tsx` | KPI cards: total devices, online/offline, today's distance |
| 🔔 Alerts | `(manager)/alerts.tsx` | Speeding, maintenance due, geofence alerts |
| ⚙️ Settings | `(manager)/settings.tsx` | Server URL, account info, disconnect |

### Driver
| Tab | Screen | Description |
|---|---|---|
| 🗺️ Map | `(driver)/map.tsx` | Map showing only driver's assigned vehicle(s) — scoped by Traccar permissions |
| 🚗 Vehicles | `(driver)/vehicles.tsx` | List of assigned vehicles with speed, status, distance today |
| ⛽ Fuel | `(driver)/fuel.tsx` | Log fill-up (liters, cost/liter, odometer) |
| 💰 Expense | `(driver)/expense.tsx` | Log expense (category, amount, notes) |
| ⚙️ Settings | `(driver)/settings.tsx` | Account info, disconnect |

---

## Project Structure

```
trackme/
├── src/                          ← existing web app (unchanged)
└── mobile/                       ← new Expo app
    ├── app.json                  ← Expo config (name, bundle ID, icons)
    ├── package.json              ← separate dependencies
    ├── tsconfig.json
    ├── .env                      ← EXPO_PUBLIC_TRACCAR_URL
    ├── app/                      ← Expo Router file-based routes
    │   ├── _layout.tsx           ← root layout (auth check → redirect)
    │   ├── login.tsx             ← login screen (all roles)
    │   ├── (manager)/
    │   │   ├── _layout.tsx       ← bottom tab navigator
    │   │   ├── map.tsx
    │   │   ├── dashboard.tsx
    │   │   ├── alerts.tsx
    │   │   └── settings.tsx
    │   └── (driver)/
    │       ├── _layout.tsx       ← bottom tab navigator
    │       ├── map.tsx
    │       ├── vehicles.tsx
    │       ├── fuel.tsx
    │       ├── expense.tsx
    │       └── settings.tsx
    ├── services/
    │   ├── traccarService.ts     ← Traccar REST API (direct, no proxy)
    │   ├── authService.ts        ← login, SecureStore credentials + role
    │   ├── fuelService.ts        ← AsyncStorage CRUD for fuel entries
    │   └── expenseService.ts     ← AsyncStorage CRUD for expense entries
    ├── components/
    │   ├── VehicleMarker.tsx     ← car icon + rotation + speeding badge animation
    │   ├── StatCard.tsx          ← KPI card (same design as web)
    │   └── AlertItem.tsx         ← alert row component
    ├── hooks/
    │   └── useFleetPolling.ts    ← polls Traccar /api/devices every 5s
    └── assets/
        ├── icon_blue.png         ← copied from web src/assets/images/
        └── icon_gray.png         ← copied from web src/assets/images/
```

---

## Authentication Flow

1. App launches → root `_layout.tsx` checks `SecureStore` for saved credentials
2. If credentials exist → call `GET /api/session` to verify still valid
3. If valid → read `trackme_current_role` from `AsyncStorage` → redirect to `/(manager)` or `/(driver)`
4. If no credentials or invalid → redirect to `/login`
5. On login: `POST /api/session` → save credentials to `SecureStore` → cache role in `AsyncStorage` → redirect

**Credentials stored in SecureStore:**
```json
{
  "serverUrl": "https://your-traccar-server.com",
  "email": "user@fleet.com",
  "password": "password"
}
```

**API calls:** Direct to Traccar server with HTTP Basic auth header. No proxy needed on mobile.
```typescript
const headers = {
  Authorization: `Basic ${btoa(`${email}:${password}`)}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};
```

---

## Map & Vehicle Markers

**Library:** `react-native-maps` (Expo managed)

**VehicleMarker component:**
- Uses `MapView.Marker` with custom view children (not `image` prop — allows overlay)
- Renders car image (`icon_gray.png` default, `icon_blue.png` for selected/tapped)
- `rotation` prop on the `MapView.Marker` drives heading angle
- Speeding: `Animated.View` overlay with pulsing red dot (same visual as web `.speeding-badge`)
- Speeding threshold: 120 km/h (matches web default)
- Speed from Traccar in knots → multiply × 1.852 for km/h (same as web)

**Polling:** `useFleetPolling` hook calls `GET /api/devices` and `GET /api/positions` every 5 seconds. No WebSocket in v1 — polling is simpler and sufficient for mobile.

**Driver map scoping:** Traccar's permission system automatically returns only the driver's assigned devices when queried with their credentials — no client-side filtering needed.

---

## Push Notifications

**Library:** `expo-notifications`

**Flow:**
1. On first speeding detection in `useFleetPolling`, call `Notifications.requestPermissionsAsync()`
2. If granted, call `Notifications.getExpoPushTokenAsync()` and save token to `AsyncStorage`
3. A Vercel serverless function at `/api/notify` (added to the existing Vercel frontend deployment):
   - Receives Traccar webhook events (configured in self-hosted Traccar admin → Notifications → Webhook)
   - Maps event type to a notification title/body
   - Calls Expo Push API (`https://exp.host/--/api/v2/push/send`) with stored push token
4. Push token must be sent to the server — stored as a Traccar user attribute (`attributes.expo_push_token`) via `PUT /api/users/{id}`

**Local notifications** (no server needed): When the app is foregrounded, detected speeding triggers a local `Notifications.scheduleNotificationAsync()` immediately.

---

## Driver Fuel & Expense Logging

Stored locally in `AsyncStorage` (same data format as web localStorage, same service logic ported to React Native).

**Fuel entry:**
- Vehicle selector (from assigned devices)
- Liters, cost per liter, odometer
- Auto-calculates total cost and fuel efficiency
- Shows Rs. prefix (PKR currency)

**Expense entry:**
- Vehicle selector
- Category (Toll/Parking/Fine/Repair/Insurance/Registration/Car Wash/Other)
- Amount (Rs.), date, notes

---

## Key Dependencies

```json
{
  "expo": "~52.x",
  "expo-router": "~4.x",
  "react-native-maps": "~1.x",
  "expo-secure-store": "~14.x",
  "expo-notifications": "~0.x",
  "@react-native-async-storage/async-storage": "~2.x",
  "react-native-safe-area-context": "4.x",
  "react-native-screens": "3.x"
}
```

---

## Environment

```env
EXPO_PUBLIC_TRACCAR_URL=https://your-traccar-server.com
```

Set in `mobile/.env`. For development: point to your self-hosted Traccar IP once the Oracle VM is provisioned.

---

## Build & Distribution

| Target | Command | Output |
|---|---|---|
| iOS simulator | `npx expo start --ios` | Dev build on Mac |
| Android emulator | `npx expo start --android` | Dev build |
| Production iOS | `eas build --platform ios` | IPA → App Store |
| Production Android | `eas build --platform android` | APK/AAB → Play Store |

Uses **EAS Build** (Expo Application Services) — free tier available, no Mac required for Android builds.

---

## Implementation Order

1. Scaffold Expo app in `mobile/` — `npx create-expo-app mobile --template`
2. Install dependencies, configure Expo Router, set up `tsconfig`
3. Copy `icon_blue.png` and `icon_gray.png` from `src/assets/images/`
4. Implement `authService.ts` — login, credential storage, role caching
5. Implement `traccarService.ts` — device list, positions, session
6. Build Login screen
7. Build root `_layout.tsx` — auth check + role-based redirect
8. Build Manager layout + Map screen with `VehicleMarker`
9. Build Manager Dashboard + Alerts screens
10. Build Driver layout + Map screen (scoped)
11. Build Driver Vehicles screen
12. Build Driver Fuel Log screen
13. Build Driver Expense screen
14. Implement push notifications (Vercel webhook bridge + local notifications)
15. Settings screens (both roles)
16. EAS build config + test on real devices
