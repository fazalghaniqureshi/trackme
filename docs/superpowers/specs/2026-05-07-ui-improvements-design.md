# TrackMe UI Improvements Design

**Date:** 2026-05-07  
**Status:** Approved

## Overview

Four clusters of improvements to TrackMe fleet app: UI polish, map fixes, mobile responsiveness, and new features. All changes are additive — no existing functionality removed.

---

## Cluster A — UI Polish

### A1. Currency — `formatCurrency()` utility
- Add `src/utils/format.ts` with `formatCurrency(amount: number): string` → returns `Rs. ${amount.toFixed(2)}`
- Replace all raw `.toFixed(2)` / `${amount}` monetary displays in: `FuelLog.tsx`, `ExpenseTracker.tsx`, `MaintenanceTracker.tsx`, `Dashboard.tsx`, `VehicleProfile.tsx`

### A2. KPI Cards — `<StatCard>` component
- Add `src/components/StatCard.tsx` — reusable card: `label`, `value`, `unit?`, `color?` (accent colour for the value), `subtitle?` (small context line below value)
- Style: dark surface (`--c-surface`), `1px` border, value in large bold with optional colour, subtle uppercase label, optional muted subtitle line
- Replace all ad-hoc KPI card `<div>` blocks in Dashboard, FuelLog, ExpenseTracker, AlertsCenter, DriverManager, MaintenanceTracker with `<StatCard>`

### A3. Connection status — sidebar card
- In `Navigation.tsx`, replace the current small footer dot+text with a full styled card when disconnected:
  - Red background (`rgba(239,68,68,0.12)`), red border, pulsing dot, "Traccar Offline" title, "Tap to connect →" subtitle
  - Wraps in `<Link to="/traccar">` so clicking navigates to settings
  - When connected: compact green pill (existing behaviour, just made more visible)

### A4. Polling badge refinement
- In `MapView.tsx`, replace the plain text "Polling" badge with a subtle animated pill: small pulsing yellow dot + "Polling" text in muted style. No change to logic.

### A5. Empty states
- Create `src/components/EmptyState.tsx` — props: `icon` (SVG path string), `title`, `message`, `action?` (`{ label, onClick }`)
- Replace all "No X yet. Click..." plain text rows in tables with `<EmptyState>` — centered, icon above title, muted message, optional action button

---

## Cluster B — Map Fixes

### B1. Map always renders tiles
- In `MapView.tsx`, ensure `<TileLayer>` renders regardless of connection state — map tiles load from OSM even when Traccar is offline
- When disconnected: render a semi-transparent overlay div (`position: absolute, inset: 0, background: rgba(8,15,30,0.72), z-index: 400`) over the map with centred icon + "Connect Traccar to see live devices" text + "Connect →" button linking to `/traccar`
- Overlay disappears as soon as `isTraccarConfigured()` is true

### B2. Marker clustering
- Install `leaflet.markercluster` + `@types/leaflet.markercluster`
- In `MapView.tsx`, wrap device markers in a `L.markerClusterGroup()` layer instead of adding directly to the map
- Clusters show count badge, expand on click, respect existing speeding/rotation marker logic
- Only active when device count > 5 (below that, no clustering needed)

---

## Cluster C — Mobile Responsive Layout

### C1. Sidebar responsive
- Sidebar already has hamburger toggle — ensure `app-sidebar` has correct `transform: translateX(-100%)` on mobile and slides in when `.open`
- Add `@media (max-width: 768px)` rules in `App.css`: sidebar overlays content (position fixed), content area is full-width
- Mobile toggle button visible only on `< 768px`

### C2. Tables horizontal scroll
- Wrap all `<table>` elements in `<div class="table-responsive">` (Bootstrap class) — this adds `overflow-x: auto` on mobile
- KPI cards: `grid-template-columns` changes from 4-across → 2-across at 768px → 1-across at 480px via CSS Grid `repeat(auto-fit, minmax(140px, 1fr))`

### C3. Map on mobile
- Map sidebar (device list) collapses to a bottom drawer on mobile (`< 768px`): hidden by default, toggle button shows/hides it, overlays bottom 40% of map

---

## Cluster D — New Features

### D1. Idle time alerts
- In `AlertsCenter.tsx`, add a new alert category: `idle`
- On load, call `getTraccarEvents()` for each device, detect sequences where `speed = 0` AND `ignition = true` (from attributes) for > 5 consecutive minutes
- Show as Warning-level alert: "Vehicle [name] has been idling for [X] min at [address]"
- Idle threshold configurable via constant `IDLE_THRESHOLD_MINUTES = 5` in `AlertsCenter.tsx`

### D2. Date range presets in Reports
- In `Reports.tsx`, above the date pickers add a preset row: `[Today] [This Week] [This Month] [Custom]`
- Selecting a preset fills the from/to date inputs and triggers a reload
- "Custom" shows the existing date pickers; presets hide them
- Active preset highlighted with accent border

### D3. Browser push notifications
- Add `src/utils/notifications.ts` with:
  - `requestNotificationPermission(): Promise<boolean>`
  - `sendNotification(title: string, body: string, tag: string): void` — checks permission before sending
- In `MapView.tsx`, when a device transitions to speeding (`isSpeeding(device)` becomes true), call `sendNotification("Speeding Alert", "${device.name} is doing ${speed} km/h", device.id)`
- Request permission on first speeding detection (not on page load — avoids annoying prompt)
- In `AlertsCenter.tsx`, send notification on new critical alert

### D4. Error boundaries
- Add `src/components/ErrorBoundary.tsx` — class component implementing `componentDidCatch`, renders a fallback card with error message and "Reload page" button
- Wrap each route's component in `<ErrorBoundary>` inside `App.tsx`

### D5. Pagination
- Add `src/hooks/usePagination.ts` — hook: `usePagination(items, pageSize = 20)` → returns `{ page, totalPages, paged, setPage, nextPage, prevPage }`
- Add `src/components/Pagination.tsx` — renders Prev / page numbers / Next with Bootstrap nav styles
- Apply to: `DriverManager`, `MaintenanceTracker`, `FuelLog`, `ExpenseTracker`, `AlertsCenter` tables

---

## File Summary

| File | Action |
|---|---|
| `src/utils/format.ts` | Create — `formatCurrency()` |
| `src/utils/notifications.ts` | Create — push notification helpers |
| `src/hooks/usePagination.ts` | Create — pagination hook |
| `src/components/StatCard.tsx` | Create — unified KPI card |
| `src/components/EmptyState.tsx` | Create — empty state component |
| `src/components/Pagination.tsx` | Create — pagination UI |
| `src/components/ErrorBoundary.tsx` | Create — error boundary |
| `src/components/Navigation.tsx` | Modify — sidebar status card |
| `src/components/MapView.tsx` | Modify — overlay + clustering |
| `src/components/Dashboard.tsx` | Modify — use StatCard |
| `src/components/FuelLog.tsx` | Modify — StatCard + formatCurrency + pagination + EmptyState |
| `src/components/ExpenseTracker.tsx` | Modify — StatCard + formatCurrency + pagination + EmptyState |
| `src/components/MaintenanceTracker.tsx` | Modify — StatCard + formatCurrency + pagination + EmptyState |
| `src/components/DriverManager.tsx` | Modify — StatCard + pagination + EmptyState |
| `src/components/AlertsCenter.tsx` | Modify — StatCard + pagination + idle alerts + push notifications |
| `src/components/Reports.tsx` | Modify — date presets |
| `src/App.tsx` | Modify — ErrorBoundary wrapping |
| `src/App.css` | Modify — mobile responsive rules + StatCard styles |
