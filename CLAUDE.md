# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on http://127.0.0.1:3001 (fixed in vite.config.ts)
npm run build     # Type-check with tsc then build for production
npm run lint      # Run ESLint
npx tsc --noEmit  # Type-check only (run after every change)
```

To kill stale dev-server processes on Windows before restarting:
```powershell
powershell -Command "@(3000,3001,3002,5173) | ForEach-Object { Get-NetTCPConnection -LocalPort \$_ -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Where-Object { \$_ -is [int] } | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue } }"
```

To deploy frontend to Hetzner server after `npm run build`:
```powershell
py scripts/deploy-frontend.py
```

To run mobile app:
```powershell
cd mobile && npx expo start --port 8083
```

No test framework is configured.

## Infrastructure

| Service | URL | Notes |
|---|---|---|
| TrackMe web app | http://62.238.24.10 | nginx serving dist/ |
| Traccar backend | http://62.238.24.10:8082 | Traccar 6.6, Java 17 |
| GPS receiver | 62.238.24.10:5027 | FMC920 TCP port |
| Traccar admin | fazalghaniqureshi@gmail.com | Uv7@Kx3!Qa9#Tm |
| Hetzner server | CX23, Helsinki | root / TrackMe@Hetzner2026! |

**Deploy script:** `scripts/deploy-frontend.py` — builds locally via `npm run build`, uploads `dist/` via SFTP, restarts nginx.

**Oracle Cloud retry:** `scripts/retry-oracle-instance.py` — still running, alternates A1.Flex/E2.1.Micro every 5 min. Check `scripts/retry-oracle.log`. If it succeeds, switch Traccar to Oracle and cancel Hetzner.

## Architecture

**TrackMe** is a React 19 + TypeScript + Vite **frontend-only** fleet tracking app. Traccar is the sole backend and database — there is no custom server. `localStorage` is used only for Traccar credentials (`traccar_config` key, storage version `v3`).

### Traccar connection

- Target server: `http://62.238.24.10:8082` (Hetzner CX23, Helsinki) — set in `.env.local` as `VITE_TRACCAR_URL`
- nginx on port 80 proxies `/traccar/*` → `http://localhost:8082/*` (same server, no CORS)
- All REST calls go through the nginx proxy at `/traccar` → Traccar, using HTTP Basic auth (`Authorization: Basic base64(email:password)`)
- WebSocket requires a cookie session (JSESSIONID) obtained by POSTing to `/api/session` with form-encoded credentials — `establishCookieSession()` in `traccarService.ts` handles this
- Speed from Traccar is in **knots** — multiply by `1.852` for km/h everywhere
- Geofence areas use Traccar WKT: `CIRCLE (lat lon, radius_metres)`
- `crypto.randomUUID()` is replaced with `generateId()` from `src/utils/format.ts` — works on HTTP (no HTTPS required)

### Device state system — `MapView.tsx`

Five states derived from position data:

| State | Condition | Color |
|---|---|---|
| `offline` | status !== "online" | Gray (dimmed icon) |
| `parked` | online + ignition off | Blue |
| `idling` | online + ignition on + speed < 2 km/h | Amber |
| `moving` | online + ignition on + speed ≥ 2 km/h | Green |
| `speeding` | online + speed > speedLimit | Red |

- `getDeviceState(device, speedLimit)` — exported from MapView, used by sidebar cards
- Map markers: SVG fleet top-down icon (Option D), colored by state, rotates with heading
- Sidebar device card: colored pill badge (Offline/Parked/Idling/Moving/Speeding) shown top-right of card
- `device.ignition` comes from `position.attributes.ignition` (boolean) sent by FMC920

### Routing — `App.tsx`

Twelve routes inside a shared `<Navigation />` bar:
- `/` — `MapView` (live map + sidebar)
- `/dashboard` — `Dashboard` (fleet KPIs + charts + alerts feed)
- `/admin` — `AdminPanel` (device CRUD synced to Traccar)
- `/reports` — `Reports` (trips / summary / events tabs)
- `/geofences` — `GeofenceManager` (create/delete circular geofences)
- `/drivers` — `DriverManager` (driver CRUD + vehicle assignment + license expiry alerts)
- `/maintenance` — `MaintenanceTracker` (service records + overdue/upcoming alerts)
- `/fuel` — `FuelLog` (fill-up log + auto fuel efficiency calculation)
- `/alerts` — `AlertsCenter` (unified view: maintenance overdue, driver license expiry, Traccar events)
- `/expenses` — `ExpenseTracker` (localStorage CRUD for vehicle expenses by category)
- `/vehicles/:id` — `VehicleProfile` (per-device page: mini-map, maintenance/fuel/trips tabs)
- `/traccar` — `TraccarSettings` (credentials form)

### Services — `src/services/`

| File | Responsibility |
|---|---|
| `traccarService.ts` | All Traccar REST + WebSocket. Key exports: `initializeTraccar`, `restoreTraccarSession`, `syncTraccarDevices`, `setupTraccarWebSocket`, `getTraccarTrips`, `getTraccarSummary`, `getTraccarEvents`, `getTraccarLocationHistory`, `getTraccarGeofences`, `createTraccarGeofence`, `deleteTraccarGeofence`, `createTraccarDevice`, `updateTraccarDevice`, `deleteTraccarDevice` |
| `deviceService.ts` | `getAllDevicesWithTraccar()` fetches live from Traccar via `syncTraccarDevices()`. Storage version v3 clears stale data on load. `getAllDevices()` is a localStorage-only fallback. |
| `geocodingService.ts` | Nominatim reverse geocoding. Rate-limited to 1 req/s, in-memory cache keyed at 4 decimal places (~11 m grid). `reverseGeocode(lat, lon)` |
| `analyticsService.ts` | Pure calculations: `calculateDistance(coord1, coord2)` returns km (Haversine). |
| `driverService.ts` | localStorage CRUD for drivers (`trackme_drivers`). `getDriverByDeviceId(deviceId)` for vehicle→driver lookup. |
| `maintenanceService.ts` | localStorage CRUD for service records (`trackme_maintenance`). `getOverdueRecords()` and `getUpcomingRecords(days)` for alert detection. |
| `fuelService.ts` | localStorage CRUD for fuel entries (`trackme_fuel`). Auto-calculates `fuelEfficiency` (km/L) at write time vs. previous odometer. `getFleetFuelStats()` for KPI cards. |
| `expenseService.ts` | localStorage CRUD for expense entries (`trackme_expenses`). Categories: Toll/Parking/Fine/Repair/Insurance/Registration/Car Wash/Other. `getFleetExpenseStats()` returns totals by category. |
| `userService.ts` | RBAC — role detection, user/group management via Traccar API. `getMyRole()`, `isAdmin()`, `canManageUsers()`. |

### Types — `src/types/`

- `device.ts` — `Device` (includes `ignition?: boolean`), `DeviceFormData`, `TeltonikaModel`
- `trip.ts` — `Trip`, `LocationPoint`, `FleetStatistics`
- `event.ts` — `TraccarTripReport`, `TraccarSummaryReport`, `TraccarEvent`, `EVENT_META`, unit helpers `knotsToKmh`, `metersToKm`, `msDuration`
- `geofence.ts` — `TraccarGeofence`, `GeofenceFormData`
- `driver.ts` — `Driver`, `DriverFormData`
- `maintenance.ts` — `MaintenanceRecord`, `MaintenanceFormData`, `MaintenanceServiceType`, `SERVICE_TYPES` array
- `fuel.ts` — `FuelEntry`, `FuelFormData`
- `expense.ts` — `ExpenseEntry`, `ExpenseFormData`, `ExpenseCategory`, `EXPENSE_CATEGORIES`, `FleetExpenseStats`
- `user.ts` — `TraccarUser`, `TraccarGroup`, `TrackMeRole`, `ROLE_LABEL`, `ROLE_COLOR`

### MapView — `src/components/MapView.tsx`

The most complex component. Key behaviour:
- **WebSocket** (`setupTraccarWebSocket`) gives real-time pushes; falls back to 5 s polling when WS is down, 30 s heartbeat always
- **Marker rotation**: `leaflet-rotatedmarker` is patched onto `L.Marker`, but react-leaflet v5 does NOT re-apply unknown props on updates. Rotation is driven **imperatively** via `marker.setRotationAngle(device.angle)` — both in the `ref` callback (mount) and in a `useEffect([devices])` (every update). Do not rely on the `rotationAngle` JSX prop alone.
- **Smooth movement**: `leaflet.marker.slideto` — `marker.slideTo(coords, {duration:800})`
- **Device state icons**: SVG fleet top-down car (Option D), color = state. No PNG files used. `makeIcon(selected, state)` builds the DivIcon inline.
- **Geofence overlay**: Loads `TraccarGeofence[]` on mount, renders react-leaflet `<Circle>` components. Toggle via "Show geofences" checkbox. Only `CIRCLE` WKT is rendered; polygons are silently skipped.
- **Auto-geocoding**: Selected device address re-geocodes when it moves > 200 m, tracked via `lastGeocodedCoordsRef`. The geocodingService cache prevents redundant Nominatim calls.
- **Route playback**: `getTraccarLocationHistory` → polyline + start/end CircleMarkers + animated playhead Marker. Speeds: 1×/5×/10×/50×.
- **Map styles**: Street (OSM), Satellite (Esri), Dark (CartoDB).

### Dashboard — `src/components/Dashboard.tsx`

Loads `getTraccarSummary` for today + 7 daily calls for the weekly bar chart. Embeds `<AlertsFeed>` for recent events. Refreshes every 30 s.

### Reports — `src/components/Reports.tsx`

Three tabs: Trips (`getTraccarTrips`), Summary (`getTraccarSummary`), Events (`getTraccarEvents` — single device only). CSV export for trips. "View" button navigates to `/?device=...&from=...&to=...`.

### AlertsFeed — `src/components/AlertsFeed.tsx`

Polls all device events (last 24 h) every 60 s. Shown on Dashboard sidebar.

### GeofenceManager — `src/components/GeofenceManager.tsx`

Map click → pick center → enter name + radius → `createTraccarGeofence()`. Lists existing zones with delete. Uses same `parseCircleWKT` regex as MapView. Color palette: `GEOFENCE_COLORS` array.

### localStorage-only features (no Traccar)

Driver Management, Maintenance Tracker, Fuel Log, and Expense Tracker are fully localStorage-based. They load devices via `getAllDevicesWithTraccar()` for vehicle dropdowns but store their own data locally. Keys: `trackme_drivers`, `trackme_maintenance`, `trackme_fuel`, `trackme_expenses`. All use `generateId()` from `src/utils/format.ts` (HTTP-safe fallback for `crypto.randomUUID()`). Dates stored as `"YYYY-MM-DD"` strings.

**Shared UI patterns** across all three:
- Bootstrap CSS modal (`modal fade show`, `display:"block"`, `modal-backdrop fade show`) — no Bootstrap JS
- Toast: `{ type, text } | null` state, `setTimeout` auto-dismiss after 4 s in `useEffect([toast])`
- Form validation: `errors: Record<string, string>`, `is-invalid` class + `invalid-feedback` div
- `handleChange` sets `formData[name]` and clears that field's error

### Mobile app — `mobile/`

React Native + Expo ~54 + expo-router ~6. Located in `mobile/` subfolder.

**Run:** `cd mobile && npx expo start --port 8083` — scan QR with iPhone Camera or enter `exp://10.113.135.202:8083` in Expo Go.

**Role-based navigation:**
- Manager/Admin: Map → Dashboard → Trips → Alerts → Settings
- Driver: Map → Vehicles → Trips → Log (Fuel/Expense) → Settings

**Key files:**
- `mobile/services/authService.ts` — login, SecureStore credentials, role detection
- `mobile/services/traccarService.ts` — direct HTTP Basic auth to Traccar (no proxy)
- `mobile/hooks/useFleetPolling.ts` — 5s device+position poll
- `mobile/components/VehicleMarker.tsx` — react-native-maps marker with rotation + speeding dot

**Server URL:** `http://62.238.24.10:8082` (set in `mobile/.env` as `EXPO_PUBLIC_TRACCAR_URL`)

### CSS

`src/assets/MapView.css` — dark sidebar theme (`#111827` background). Contains:
- `.speeding-badge` — pulsing red dot (`speed-pulse` keyframe)
- `.idling-badge` — pulsing amber dot (`idle-pulse` keyframe)
- `.device-card.speeding` styles
