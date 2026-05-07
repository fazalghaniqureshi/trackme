# TrackMe UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 4 improvement clusters — UI polish, map fixes, mobile responsiveness, and new features — across the TrackMe fleet tracking app.

**Architecture:** New shared primitives (`StatCard`, `EmptyState`, `Pagination`, `ErrorBoundary`, `formatCurrency`, `usePagination`, `sendNotification`) are created first, then consumed by existing components in order from least-dependent to most-dependent. MapView gets an always-on tile layer with offline overlay. Mobile layout uses CSS-only responsive rules.

**Tech Stack:** React 19, TypeScript, react-leaflet v5, leaflet.markercluster, Bootstrap 5 CSS, CSS custom properties

---

## Files Created

| File | Purpose |
|---|---|
| `src/utils/format.ts` | `formatCurrency(n)` → `"Rs. 0.00"` |
| `src/utils/notifications.ts` | Browser push notification helpers |
| `src/hooks/usePagination.ts` | Generic pagination hook |
| `src/components/StatCard.tsx` | Unified KPI card (minimal dark style) |
| `src/components/EmptyState.tsx` | Empty table/list state with icon + CTA |
| `src/components/Pagination.tsx` | Prev / page numbers / Next UI |
| `src/components/ErrorBoundary.tsx` | Class-based React error boundary |

## Files Modified

| File | Changes |
|---|---|
| `src/components/Navigation.tsx` | Sidebar offline card |
| `src/components/MapView.tsx` | Always-on tiles, offline overlay, marker clustering |
| `src/components/Dashboard.tsx` | StatCard |
| `src/components/FuelLog.tsx` | StatCard + formatCurrency + pagination + EmptyState |
| `src/components/ExpenseTracker.tsx` | StatCard + formatCurrency + pagination + EmptyState |
| `src/components/MaintenanceTracker.tsx` | StatCard + formatCurrency + pagination + EmptyState |
| `src/components/DriverManager.tsx` | StatCard + pagination + EmptyState |
| `src/components/AlertsCenter.tsx` | StatCard + pagination + idle alerts + push notifications |
| `src/components/Reports.tsx` | Date range presets |
| `src/App.tsx` | ErrorBoundary wrapping each route |
| `src/App.css` | StatCard styles + mobile responsive + sidebar offline card |

---

## Task 1: Install leaflet.markercluster

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install the package**

```powershell
cd C:\trackme
npm install react-leaflet-cluster leaflet.markercluster
npm install --save-dev @types/leaflet.markercluster
```

Expected: packages added, no peer dep errors.

- [ ] **Step 2: Verify TypeScript can resolve the types**

```powershell
npx tsc --noEmit
```

Expected: same errors as before (none from the new package).

- [ ] **Step 3: Commit**

```powershell
git add package.json package-lock.json
git commit -m "chore: add react-leaflet-cluster for map marker grouping"
```

---

## Task 2: Foundation utilities

**Files:**
- Create: `src/utils/format.ts`
- Create: `src/utils/notifications.ts`
- Create: `src/hooks/usePagination.ts`

- [ ] **Step 1: Create `src/utils/format.ts`**

```typescript
export const formatCurrency = (amount: number): string =>
  `Rs. ${amount.toFixed(2)}`;

export const formatNumber = (n: number, decimals = 0): string =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
```

- [ ] **Step 2: Create `src/utils/notifications.ts`**

```typescript
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

export const sendNotification = (
  title: string,
  body: string,
  tag: string
): void => {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, tag, icon: '/vite.svg' });
};
```

- [ ] **Step 3: Create `src/hooks/usePagination.ts`**

```typescript
import { useState, useMemo } from 'react';

export const usePagination = <T>(items: T[], pageSize = 20) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return {
    page: safePage,
    totalPages,
    paged,
    setPage,
    nextPage: () => setPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setPage((p) => Math.max(p - 1, 1)),
  };
};
```

- [ ] **Step 4: Type-check**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/format.ts src/utils/notifications.ts src/hooks/usePagination.ts
git commit -m "feat: add formatCurrency, notification helpers, usePagination hook"
```

---

## Task 3: StatCard component + CSS

**Files:**
- Create: `src/components/StatCard.tsx`
- Modify: `src/App.css` (add stat-card styles)

- [ ] **Step 1: Create `src/components/StatCard.tsx`**

```tsx
interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  subtitle?: string;
  unit?: string;
}

const StatCard = ({ label, value, color, subtitle, unit }: StatCardProps) => (
  <div className="stat-card">
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value" style={color ? { color } : undefined}>
      {value}
      {unit && <span className="stat-card-unit">{unit}</span>}
    </div>
    {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
  </div>
);

export default StatCard;
```

- [ ] **Step 2: Add StatCard styles to `src/App.css`**

Find the end of the file and append:

```css
/* ── StatCard ─────────────────────────────────────────── */
.stat-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  padding: 16px;
  height: 100%;
}

.stat-card-label {
  color: var(--c-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.stat-card-value {
  color: var(--c-text);
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}

.stat-card-unit {
  font-size: 14px;
  font-weight: 400;
  color: var(--c-muted);
  margin-left: 3px;
}

.stat-card-subtitle {
  color: var(--c-muted);
  font-size: 11px;
  margin-top: 6px;
}
```

- [ ] **Step 3: Type-check**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```powershell
git add src/components/StatCard.tsx src/App.css
git commit -m "feat: add StatCard component — unified minimal dark KPI card"
```

---

## Task 4: EmptyState component

**Files:**
- Create: `src/components/EmptyState.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Create `src/components/EmptyState.tsx`**

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

const EmptyState = ({ icon, title, message, action }: EmptyStateProps) => (
  <div className="empty-state">
    {icon && <div className="empty-state-icon">{icon}</div>}
    <div className="empty-state-title">{title}</div>
    <div className="empty-state-message">{message}</div>
    {action && (
      <button className="btn btn-sm btn-outline-primary mt-3" onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
```

- [ ] **Step 2: Add EmptyState styles to `src/App.css`**

```css
/* ── EmptyState ───────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-state-icon {
  color: var(--c-subtle);
  margin-bottom: 16px;
}

.empty-state-title {
  color: var(--c-text);
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}

.empty-state-message {
  color: var(--c-muted);
  font-size: 13px;
  max-width: 300px;
}
```

- [ ] **Step 3: Commit**

```powershell
git add src/components/EmptyState.tsx src/App.css
git commit -m "feat: add EmptyState component"
```

---

## Task 5: Pagination component

**Files:**
- Create: `src/components/Pagination.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Create `src/components/Pagination.tsx`**

```tsx
interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

const Pagination = ({ page, totalPages, onPage }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  // Show max 7 page numbers: first, last, current ±2, with ellipsis
  const visible = pages.filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
  );

  return (
    <div className="pagination-bar">
      <button
        className="pagination-btn"
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
      >
        ‹
      </button>

      {visible.map((p, i) => {
        const prev = visible[i - 1];
        const showEllipsis = prev && p - prev > 1;
        return (
          <span key={p} className="d-contents">
            {showEllipsis && <span className="pagination-ellipsis">…</span>}
            <button
              className={`pagination-btn${p === page ? ' active' : ''}`}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          </span>
        );
      })}

      <button
        className="pagination-btn"
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
      >
        ›
      </button>
    </div>
  );
};

export default Pagination;
```

- [ ] **Step 2: Add Pagination styles to `src/App.css`**

```css
/* ── Pagination ───────────────────────────────────────── */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px 0 4px;
}

.pagination-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  color: var(--c-muted);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--c-surface-3);
  color: var(--c-text);
}

.pagination-btn.active {
  background: var(--c-accent);
  border-color: var(--c-accent);
  color: #fff;
}

.pagination-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.pagination-ellipsis {
  color: var(--c-subtle);
  padding: 0 4px;
  font-size: 13px;
  line-height: 32px;
}

.d-contents { display: contents; }
```

- [ ] **Step 3: Commit**

```powershell
git add src/components/Pagination.tsx src/App.css
git commit -m "feat: add Pagination component"
```

---

## Task 6: ErrorBoundary component

**Files:**
- Create: `src/components/ErrorBoundary.tsx`

- [ ] **Step 1: Create `src/components/ErrorBoundary.tsx`**

```tsx
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container-fluid p-4">
          <div className="alert alert-danger">
            <h5 className="alert-heading mb-2">Something went wrong</h5>
            <p className="mb-3" style={{ fontFamily: 'monospace', fontSize: 13 }}>
              {this.state.error.message}
            </p>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

- [ ] **Step 2: Commit**

```powershell
git add src/components/ErrorBoundary.tsx
git commit -m "feat: add ErrorBoundary component"
```

---

## Task 7: Navigation — sidebar offline card

**Files:**
- Modify: `src/components/Navigation.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Replace the sidebar footer in `Navigation.tsx`**

Find this block (lines ~217–225):

```tsx
        {/* Footer status */}
        <div className="sidebar-footer">
          <div className="sidebar-status">
            <div className={`sidebar-status-dot ${connected ? "connected" : "disconnected"}`} />
            <span style={{ fontSize: 12, color: "var(--c-muted)" }}>
              {connected ? "Traccar Connected" : "Traccar Offline"}
            </span>
          </div>
        </div>
```

Replace with:

```tsx
        {/* Footer status */}
        <div className="sidebar-footer">
          {connected ? (
            <div className="sidebar-status">
              <div className="sidebar-status-dot connected" />
              <span style={{ fontSize: 12, color: "var(--c-muted)" }}>Traccar Connected</span>
            </div>
          ) : (
            <Link to="/traccar" className="sidebar-offline-card" onClick={close}>
              <span className="sidebar-offline-dot" />
              <div>
                <div className="sidebar-offline-title">Traccar Offline</div>
                <div className="sidebar-offline-sub">Tap to connect →</div>
              </div>
            </Link>
          )}
        </div>
```

- [ ] **Step 2: Add sidebar offline card styles to `src/App.css`**

```css
/* ── Sidebar offline card ─────────────────────────────── */
.sidebar-offline-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.28);
  border-radius: var(--r-md);
  padding: 10px 12px;
  text-decoration: none;
  margin: 0 8px 8px;
  transition: background 0.15s;
}

.sidebar-offline-card:hover {
  background: rgba(239, 68, 68, 0.18);
}

.sidebar-offline-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
  animation: pulse-offline 1.5s ease-in-out infinite;
}

@keyframes pulse-offline {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.sidebar-offline-title {
  color: #fca5a5;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}

.sidebar-offline-sub {
  color: #f87171;
  font-size: 11px;
}
```

- [ ] **Step 3: Type-check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 4: Start dev server and verify**

```powershell
npm run dev
```

Open `http://127.0.0.1:3001` — sidebar footer should show the red pulsing offline card. Clicking it should navigate to `/traccar`.

- [ ] **Step 5: Commit**

```powershell
git add src/components/Navigation.tsx src/App.css
git commit -m "feat: sidebar offline card — prominent Traccar connection status"
```

---

## Task 8: MapView — always-on tiles + offline overlay + marker clustering

**Files:**
- Modify: `src/components/MapView.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add MarkerClusterGroup import at top of `MapView.tsx`**

After the existing imports, add:

```tsx
import MarkerClusterGroup from 'react-leaflet-cluster';
```

- [ ] **Step 2: Find the map render section (~line 753) and replace it**

Find:

```tsx
        {/* ── Map ── */}
        {devices.length > 0 ? (
          <MapContainer
            center={selectedDevice?.coords ?? devices[0].coords}
            zoom={14}
            className="map"
          >
```

Replace with:

```tsx
        {/* ── Map ── */}
        <div className="map-area">
          <MapContainer
            center={
              devices.length > 0
                ? (selectedDevice?.coords ?? devices[0].coords)
                : [30.3753, 69.3451]
            }
            zoom={devices.length > 0 ? 14 : 6}
            className="map"
          >
```

- [ ] **Step 3: Find the closing brace of the old conditional render**

After the `</MapContainer>` tag, find:

```tsx
        ) : (
          <div className="map d-flex flex-column align-items-center justify-content-center"
            style={{ background: "var(--c-surface)" }}>
            <div style={{ color: "var(--c-muted)", marginBottom: 8 }}>No devices found</div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/traccar")}>
              Connect to Traccar
            </button>
          </div>
        )}
```

Replace that entire block with:

```tsx
          {!isTraccarConfigured() && (
            <div className="map-offline-overlay">
              <div className="map-offline-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  strokeLinejoin="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              </div>
              <div className="map-offline-title">Connect Traccar to see live devices</div>
              <button
                className="btn btn-primary btn-sm mt-2"
                onClick={() => navigate("/traccar")}
              >
                Connect →
              </button>
            </div>
          )}
        </div>
```

- [ ] **Step 4: Wrap device markers in MarkerClusterGroup**

Inside `<MapContainer>`, find the section that renders device `<Marker>` components. It will look like:

```tsx
            {devices.map((device) => {
```

Wrap it in `<MarkerClusterGroup>`:

```tsx
            <MarkerClusterGroup chunkedLoading>
              {devices.map((device) => {
                ...existing marker JSX...
              })}
            </MarkerClusterGroup>
```

- [ ] **Step 5: Add map overlay CSS to `src/App.css`**

```css
/* ── Map area + offline overlay ───────────────────────── */
.map-area {
  position: relative;
  flex: 1;
  display: flex;
}

.map-offline-overlay {
  position: absolute;
  inset: 0;
  z-index: 400;
  background: rgba(8, 15, 30, 0.74);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  pointer-events: all;
}

.map-offline-icon {
  color: var(--c-subtle);
  margin-bottom: 4px;
}

.map-offline-title {
  color: var(--c-text);
  font-size: 15px;
  font-weight: 600;
}
```

- [ ] **Step 6: Type-check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 7: Visual verify**

Open `http://127.0.0.1:3001/` — map tiles should now load even when disconnected. The semi-transparent overlay with "Connect Traccar" should appear over the map.

- [ ] **Step 8: Commit**

```powershell
git add src/components/MapView.tsx src/App.css
git commit -m "feat: map always shows tiles, offline overlay, marker clustering"
```

---

## Task 9: Dashboard — StatCard

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Add StatCard import**

```tsx
import StatCard from './StatCard';
```

- [ ] **Step 2: Replace KPI card row**

Find the main KPI row (the one with `Total Devices`, `Online`, `Offline`, `Today's Distance`, etc.). It uses a pattern like:

```tsx
<div className="row g-3 mb-4">
  <div className="col-6 col-md-2">
    <div className="card text-white bg-primary h-100">
      <div className="card-body py-3">
        <div className="small opacity-75">Total Devices</div>
        <div className="fs-4 fw-bold">{devices.length}</div>
      </div>
    </div>
  </div>
  ...
```

Replace the entire KPI row with:

```tsx
<div className="row g-3 mb-4">
  {[
    { label: "Total Devices", value: devices.length, color: "var(--c-accent)" },
    { label: "Online", value: devices.filter((d) => d.status === "online").length, color: "var(--c-success)" },
    { label: "Offline", value: devices.filter((d) => d.status === "offline").length, color: "var(--c-danger)" },
    {
      label: "Today's Distance",
      value: stats ? metersToKm(stats.distance).toFixed(1) : "0.0",
      unit: "km",
    },
    {
      label: "Max Speed Today",
      value: stats ? knotsToKmh(stats.maxSpeed).toFixed(0) : "0",
      unit: "km/h",
    },
    {
      label: "Avg Speed Today",
      value: stats ? knotsToKmh(stats.averageSpeed).toFixed(0) : "0",
      unit: "km/h",
    },
  ].map((c) => (
    <div key={c.label} className="col-6 col-md-2">
      <StatCard label={c.label} value={c.value} color={c.color} unit={c.unit} />
    </div>
  ))}
</div>
```

- [ ] **Step 3: Replace fleet health KPI row**

Find the fleet health row (Overdue Maintenance, Licenses Expiring, Active Drivers, Fuel Cost). Replace with StatCard pattern:

```tsx
<div className="row g-3 mb-4">
  {[
    {
      label: "Overdue Maintenance",
      value: overdueCount,
      color: overdueCount > 0 ? "var(--c-danger)" : "var(--c-success)",
    },
    {
      label: "Licenses Expiring (30d)",
      value: expiringLicenses,
      color: expiringLicenses > 0 ? "var(--c-warning)" : "var(--c-success)",
    },
    { label: "Active Drivers", value: activeDrivers, color: "var(--c-accent)" },
    {
      label: "Fuel Cost This Month",
      value: `Rs. ${fuelThisMonth.toFixed(2)}`,
    },
  ].map((c) => (
    <div key={c.label} className="col-6 col-md-3">
      <StatCard label={c.label} value={c.value} color={c.color} />
    </div>
  ))}
</div>
```

- [ ] **Step 4: Type-check and verify**

```powershell
npx tsc --noEmit
```

Open `http://127.0.0.1:3001/dashboard` — KPI cards should be minimal dark style.

- [ ] **Step 5: Commit**

```powershell
git add src/components/Dashboard.tsx
git commit -m "feat: dashboard KPI cards use StatCard"
```

---

## Task 10: FuelLog — StatCard + formatCurrency + pagination + EmptyState

**Files:**
- Modify: `src/components/FuelLog.tsx`

- [ ] **Step 1: Add imports**

```tsx
import StatCard from './StatCard';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
import { formatCurrency } from '../utils/format';
```

- [ ] **Step 2: Add pagination hook after filteredEntries**

After the `filteredEntries` definition, add:

```tsx
const { page, totalPages, paged: pagedEntries, setPage } = usePagination(filteredEntries);
```

- [ ] **Step 3: Replace KPI card row**

Find the existing KPI card row (lines ~178–212) with bootstrap gradient cards. Replace with:

```tsx
<div className="row g-3 mb-4">
  {[
    { label: "Total Fill-Ups", value: stats.totalFillUps, color: "var(--c-accent)" },
    { label: "Total Fuel", value: stats.totalLiters.toFixed(1), unit: "L", color: "var(--c-text)" },
    { label: "Total Fuel Cost", value: formatCurrency(stats.totalCost) },
    {
      label: "Avg Efficiency",
      value: stats.avgEfficiency != null ? stats.avgEfficiency.toFixed(2) : "—",
      unit: stats.avgEfficiency != null ? "km/L" : "",
      color: "var(--c-success)",
    },
  ].map((c) => (
    <div key={c.label} className="col-6 col-md-3">
      <StatCard label={c.label} value={c.value} color={c.color} unit={c.unit} />
    </div>
  ))}
</div>
```

- [ ] **Step 4: Replace empty table row with EmptyState**

Find the `<tr>` that shows "No fuel records yet." and replace the entire conditional:

```tsx
{pagedEntries.length === 0 ? (
  <tr>
    <td colSpan={9}>
      <EmptyState
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 22V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15" />
            <path d="M2 22h14" />
            <path d="M15 7h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9a7 7 0 0 0-7-7H15" />
            <line x1="6" y1="11" x2="12" y2="11" />
          </svg>
        }
        title="No fuel records yet"
        message="Log your first fill-up to start tracking fuel costs and efficiency."
        action={{ label: "+ Log Fill-Up", onClick: handleOpenAdd }}
      />
    </td>
  </tr>
) : (
  pagedEntries.map((entry) => (
    ...existing row JSX, unchanged...
  ))
)}
```

- [ ] **Step 5: Add Pagination below table**

After the closing `</table>` tag and before the closing `</div>` of the card:

```tsx
<Pagination page={page} totalPages={totalPages} onPage={setPage} />
```

- [ ] **Step 6: Replace `filteredEntries.map` with `pagedEntries.map` in table body**

Ensure the table body uses `pagedEntries` not `filteredEntries`.

- [ ] **Step 7: Replace cost display with formatCurrency**

In the table row, find where `entry.totalCost` is displayed (likely as `{entry.totalCost.toFixed(2)}`). Replace with:

```tsx
{formatCurrency(entry.totalCost)}
```

Also update `{entry.costPerLiter.toFixed(2)}` to show as currency:

```tsx
{formatCurrency(entry.costPerLiter)}
```

- [ ] **Step 8: Type-check and verify**

```powershell
npx tsc --noEmit
```

Open `http://127.0.0.1:3001/fuel` — KPI cards should be minimal dark, Rs. prefix on costs, pagination visible when >20 entries.

- [ ] **Step 9: Commit**

```powershell
git add src/components/FuelLog.tsx
git commit -m "feat: FuelLog — StatCard, formatCurrency, pagination, EmptyState"
```

---

## Task 11: ExpenseTracker — StatCard + formatCurrency + pagination + EmptyState

**Files:**
- Modify: `src/components/ExpenseTracker.tsx`

- [ ] **Step 1: Add imports**

```tsx
import StatCard from './StatCard';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
import { formatCurrency } from '../utils/format';
```

- [ ] **Step 2: Add pagination hook**

After `filteredEntries` definition:

```tsx
const { page, totalPages, paged: pagedEntries, setPage } = usePagination(filteredEntries);
```

- [ ] **Step 3: Replace KPI card row with StatCard**

Find the existing KPI cards (Total Expenses, Total Records, Top Category, This Month). Replace with:

```tsx
<div className="row g-3 mb-4">
  {[
    { label: "Total Expenses", value: formatCurrency(stats.totalAmount) },
    { label: "Total Records", value: stats.totalCount, color: "var(--c-accent)" },
    { label: "Top Category", value: stats.topCategory ?? "—" },
    { label: "This Month", value: formatCurrency(stats.thisMonthAmount) },
  ].map((c) => (
    <div key={c.label} className="col-6 col-md-3">
      <StatCard label={c.label} value={c.value} color={c.color} />
    </div>
  ))}
</div>
```

- [ ] **Step 4: Replace empty table row with EmptyState**

```tsx
{pagedEntries.length === 0 ? (
  <tr>
    <td colSpan={7}>
      <EmptyState
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        }
        title="No expenses yet"
        message="Add your first expense to start tracking fleet costs."
        action={{ label: "+ Add Expense", onClick: handleOpenAdd }}
      />
    </td>
  </tr>
) : (
  pagedEntries.map((entry) => ( ...existing row JSX... ))
)}
```

- [ ] **Step 5: Add Pagination + formatCurrency in table rows**

After `</table>`, add:

```tsx
<Pagination page={page} totalPages={totalPages} onPage={setPage} />
```

In table rows, replace `entry.amount.toFixed(2)` with `formatCurrency(entry.amount)`.

- [ ] **Step 6: Type-check, verify, commit**

```powershell
npx tsc --noEmit
git add src/components/ExpenseTracker.tsx
git commit -m "feat: ExpenseTracker — StatCard, formatCurrency, pagination, EmptyState"
```

---

## Task 12: MaintenanceTracker — StatCard + formatCurrency + pagination + EmptyState

**Files:**
- Modify: `src/components/MaintenanceTracker.tsx`

- [ ] **Step 1: Add imports**

```tsx
import StatCard from './StatCard';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
import { formatCurrency } from '../utils/format';
```

- [ ] **Step 2: Add pagination hook after filteredRecords**

```tsx
const { page, totalPages, paged: pagedRecords, setPage } = usePagination(filteredRecords);
```

- [ ] **Step 3: Replace KPI cards**

```tsx
<div className="row g-3 mb-4">
  {[
    { label: "Total Records", value: records.length, color: "var(--c-accent)" },
    { label: "Overdue", value: records.filter((r) => r.status === "overdue").length, color: "var(--c-danger)" },
    { label: "Due This Month", value: records.filter((r) => r.status === "upcoming").length, color: "var(--c-warning)" },
    { label: "Total Cost", value: formatCurrency(records.reduce((s, r) => s + (r.cost ?? 0), 0)) },
  ].map((c) => (
    <div key={c.label} className="col-6 col-md-3">
      <StatCard label={c.label} value={c.value} color={c.color} />
    </div>
  ))}
</div>
```

- [ ] **Step 4: Replace empty row with EmptyState**

```tsx
{pagedRecords.length === 0 ? (
  <tr>
    <td colSpan={8}>
      <EmptyState
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        }
        title="No service records yet"
        message="Log your first maintenance entry to track service history."
        action={{ label: "+ Log Service", onClick: handleOpenAdd }}
      />
    </td>
  </tr>
) : (
  pagedRecords.map((r) => ( ...existing row JSX... ))
)}
```

- [ ] **Step 5: Add Pagination + formatCurrency**

After `</table>`: `<Pagination page={page} totalPages={totalPages} onPage={setPage} />`

Replace cost display with `formatCurrency(r.cost ?? 0)`.

- [ ] **Step 6: Type-check, verify, commit**

```powershell
npx tsc --noEmit
git add src/components/MaintenanceTracker.tsx
git commit -m "feat: MaintenanceTracker — StatCard, formatCurrency, pagination, EmptyState"
```

---

## Task 13: DriverManager — StatCard + pagination + EmptyState

**Files:**
- Modify: `src/components/DriverManager.tsx`

- [ ] **Step 1: Add imports**

```tsx
import StatCard from './StatCard';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
```

- [ ] **Step 2: Add pagination hook after filteredDrivers**

```tsx
const { page, totalPages, paged: pagedDrivers, setPage } = usePagination(filteredDrivers);
```

- [ ] **Step 3: Replace KPI cards**

```tsx
<div className="row g-3 mb-4">
  {[
    { label: "Total Drivers", value: drivers.length, color: "var(--c-accent)" },
    { label: "Assigned", value: drivers.filter((d) => d.assignedDeviceId).length, color: "var(--c-success)" },
    { label: "Unassigned", value: drivers.filter((d) => !d.assignedDeviceId).length },
    {
      label: "License Expiring Soon",
      value: drivers.filter((d) => {
        const days = Math.ceil((new Date(d.licenseExpiry).getTime() - Date.now()) / 86400000);
        return days >= 0 && days <= 30;
      }).length,
      color: "var(--c-warning)",
    },
  ].map((c) => (
    <div key={c.label} className="col-6 col-md-3">
      <StatCard label={c.label} value={c.value} color={c.color} />
    </div>
  ))}
</div>
```

- [ ] **Step 4: Replace empty row with EmptyState**

```tsx
{pagedDrivers.length === 0 ? (
  <tr>
    <td colSpan={7}>
      <EmptyState
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        }
        title="No drivers yet"
        message="Add your first driver to assign them to vehicles and track license expiry."
        action={{ label: "+ Add Driver", onClick: handleOpenAdd }}
      />
    </td>
  </tr>
) : (
  pagedDrivers.map((driver) => ( ...existing row JSX... ))
)}
```

- [ ] **Step 5: Pagination + commit**

After `</table>`: `<Pagination page={page} totalPages={totalPages} onPage={setPage} />`

```powershell
npx tsc --noEmit
git add src/components/DriverManager.tsx
git commit -m "feat: DriverManager — StatCard, pagination, EmptyState"
```

---

## Task 14: AlertsCenter — StatCard + pagination + idle alerts + push notifications

**Files:**
- Modify: `src/components/AlertsCenter.tsx`

- [ ] **Step 1: Add imports**

```tsx
import StatCard from './StatCard';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
import { sendNotification, requestNotificationPermission } from '../utils/notifications';
```

- [ ] **Step 2: Add idle alert category to the type**

Find:

```tsx
type AlertCategory = "maintenance" | "driver" | "traccar";
```

Replace with:

```tsx
type AlertCategory = "maintenance" | "driver" | "traccar" | "idle";
```

Add to `CATEGORY_LABEL`:

```tsx
const CATEGORY_LABEL: Record<AlertCategory, string> = {
  maintenance: "Maintenance",
  driver: "Driver",
  traccar: "Vehicle Event",
  idle: "Idle",
};
```

- [ ] **Step 3: Add idle detection in loadAlerts after Traccar events block**

At the end of the `loadAlerts` function, before `setAlerts(result...)`, add:

```tsx
      // ── Idle detection ──────────────────────────────────────────
      const IDLE_THRESHOLD_MINUTES = 5;
      if (isTraccarConfigured()) {
        const now = new Date();
        const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        for (const device of devices) {
          if (!device.traccarId) continue;
          try {
            const evts = await getTraccarEvents(device.traccarId, from, now);
            let idleStart: Date | null = null;
            for (const evt of evts) {
              const attrs = (evt as any).attributes ?? {};
              const speed = typeof attrs.speed === 'number' ? attrs.speed : 0;
              const ignition = attrs.ignition === true;
              if (ignition && speed < 1) {
                if (!idleStart) idleStart = new Date(evt.eventTime);
              } else {
                if (idleStart) {
                  const idleMin = (new Date(evt.eventTime).getTime() - idleStart.getTime()) / 60000;
                  if (idleMin >= IDLE_THRESHOLD_MINUTES) {
                    result.push({
                      id: `idle-${device.id}-${idleStart.getTime()}`,
                      severity: "warning",
                      category: "idle",
                      title: `Idle: ${deviceName(device.id)}`,
                      detail: `Engine on, stationary for ${Math.round(idleMin)} min`,
                      timestamp: idleStart,
                    });
                  }
                  idleStart = null;
                }
              }
            }
          } catch {
            // skip idle detection for this device if events unavailable
          }
        }
      }
```

- [ ] **Step 4: Send push notification for new critical alerts**

After `setAlerts(result...)` and `setLastRefresh(new Date())`, add:

```tsx
      // Push notification for critical alerts
      const critical = result.filter((a) => a.severity === "danger");
      if (critical.length > 0) {
        const granted = await requestNotificationPermission();
        if (granted) {
          critical.slice(0, 3).forEach((a) =>
            sendNotification(`🚨 ${a.title}`, a.detail, a.id)
          );
        }
      }
```

- [ ] **Step 5: Add pagination**

After the filtered alerts definition, add:

```tsx
const { page, totalPages, paged: pagedAlerts, setPage } = usePagination(filteredAlerts);
```

Replace all uses of `filteredAlerts.map(...)` in the table/list with `pagedAlerts.map(...)`.

Add after table: `<Pagination page={page} totalPages={totalPages} onPage={setPage} />`

- [ ] **Step 6: Replace KPI cards**

```tsx
<div className="row g-3 mb-4">
  {[
    {
      label: "Critical",
      value: alerts.filter((a) => a.severity === "danger").length,
      color: "var(--c-danger)",
    },
    {
      label: "Warnings",
      value: alerts.filter((a) => a.severity === "warning").length,
      color: "var(--c-warning)",
    },
    {
      label: "Info",
      value: alerts.filter((a) => a.severity === "info").length,
      color: "var(--c-accent)",
    },
  ].map((c) => (
    <div key={c.label} className="col-4">
      <StatCard label={c.label} value={c.value} color={c.color} />
    </div>
  ))}
</div>
```

- [ ] **Step 7: Add EmptyState when no alerts**

Replace the empty state div/text with:

```tsx
<EmptyState
  icon={
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  }
  title="No active alerts"
  message="Everything looks good — no maintenance, driver, or vehicle alerts."
/>
```

- [ ] **Step 8: Type-check, verify, commit**

```powershell
npx tsc --noEmit
git add src/components/AlertsCenter.tsx
git commit -m "feat: AlertsCenter — StatCard, pagination, idle alerts, push notifications"
```

---

## Task 15: Reports — date range presets

**Files:**
- Modify: `src/components/Reports.tsx`

- [ ] **Step 1: Add preset helper above the component**

```tsx
const getPresetDates = (preset: "today" | "week" | "month") => {
  const now = new Date();
  if (preset === "today") return {
    from: format(now, "yyyy-MM-dd"),
    to: format(now, "yyyy-MM-dd"),
  };
  if (preset === "week") return {
    from: format(subDays(now, 7), "yyyy-MM-dd"),
    to: format(now, "yyyy-MM-dd"),
  };
  return {
    from: format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"),
    to: format(now, "yyyy-MM-dd"),
  };
};
```

- [ ] **Step 2: Add preset state**

Inside the `Reports` component, add:

```tsx
const [preset, setPreset] = useState<"today" | "week" | "month" | "custom">("week");
```

- [ ] **Step 3: Add preset handler**

```tsx
const applyPreset = (p: "today" | "week" | "month") => {
  setPreset(p);
  const { from, to } = getPresetDates(p);
  setStartDate(from);
  setEndDate(to);
};
```

- [ ] **Step 4: Add preset buttons above date pickers**

Find the date picker inputs area (where `startDate` and `endDate` inputs are). Add ABOVE them:

```tsx
<div className="d-flex gap-2 mb-3 flex-wrap">
  {(["today", "week", "month", "custom"] as const).map((p) => (
    <button
      key={p}
      className={`btn btn-sm ${preset === p ? "btn-primary" : "btn-outline-secondary"}`}
      onClick={() => {
        if (p === "custom") {
          setPreset("custom");
        } else {
          applyPreset(p);
        }
      }}
    >
      {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom"}
    </button>
  ))}
</div>
```

- [ ] **Step 5: Show date pickers only in custom mode**

Wrap the date picker inputs:

```tsx
{preset === "custom" && (
  <div className="row g-2 mb-3">
    {/* existing from/to date inputs */}
  </div>
)}
```

- [ ] **Step 6: Type-check, verify, commit**

```powershell
npx tsc --noEmit
```

Open `http://127.0.0.1:3001/reports` — preset buttons should appear. Clicking "Today" or "This Week" should update dates and trigger a reload.

```powershell
git add src/components/Reports.tsx
git commit -m "feat: Reports — date range presets (Today / This Week / This Month / Custom)"
```

---

## Task 16: App.tsx — ErrorBoundary wrapping

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add ErrorBoundary import**

```tsx
import ErrorBoundary from './components/ErrorBoundary';
```

- [ ] **Step 2: Wrap each route's element in ErrorBoundary**

Find the `<Routes>` block. Wrap each `element={<ComponentName />}` with `<ErrorBoundary>`:

```tsx
<Routes>
  <Route path="/" element={<ErrorBoundary><MapView /></ErrorBoundary>} />
  <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
  <Route path="/admin" element={<ErrorBoundary><AdminPanel /></ErrorBoundary>} />
  <Route path="/reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
  <Route path="/geofences" element={<ErrorBoundary><GeofenceManager /></ErrorBoundary>} />
  <Route path="/drivers" element={<ErrorBoundary><DriverManager /></ErrorBoundary>} />
  <Route path="/maintenance" element={<ErrorBoundary><MaintenanceTracker /></ErrorBoundary>} />
  <Route path="/fuel" element={<ErrorBoundary><FuelLog /></ErrorBoundary>} />
  <Route path="/alerts" element={<ErrorBoundary><AlertsCenter /></ErrorBoundary>} />
  <Route path="/expenses" element={<ErrorBoundary><ExpenseTracker /></ErrorBoundary>} />
  <Route path="/vehicles/:id" element={<ErrorBoundary><VehicleProfile /></ErrorBoundary>} />
  <Route path="/traccar" element={<ErrorBoundary><TraccarSettings /></ErrorBoundary>} />
</Routes>
```

- [ ] **Step 3: Type-check, verify, commit**

```powershell
npx tsc --noEmit
git add src/App.tsx
git commit -m "feat: wrap all routes in ErrorBoundary"
```

---

## Task 17: App.css — mobile responsive layout

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add responsive media queries at the end of `src/App.css`**

```css
/* ════════════════════════════════════════════════════════
   Mobile responsive — max-width: 768px
   ════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  /* Sidebar overlays content on mobile */
  .app-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 1050;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }

  .app-sidebar.open {
    transform: translateX(0);
  }

  /* Content area is full-width on mobile */
  .app-main {
    margin-left: 0 !important;
    width: 100% !important;
  }

  /* Hamburger button visible on mobile */
  .mobile-nav-toggle {
    display: flex !important;
  }

  /* KPI cards: 2 across on mobile */
  .row.g-3 > [class*="col-md-2"],
  .row.g-3 > [class*="col-md-3"],
  .row.g-3 > [class*="col-md-4"] {
    flex: 0 0 50%;
    max-width: 50%;
  }

  /* Tables: horizontal scroll */
  .table-responsive-mobile {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Page padding reduced */
  .container-fluid.p-4 {
    padding: 12px !important;
  }

  /* Page title sizing */
  h1.mb-0 {
    font-size: 20px;
  }

  /* Map sidebar collapses to bottom on mobile */
  .map-container {
    flex-direction: column;
  }

  .sidebar {
    width: 100% !important;
    height: auto !important;
    max-height: 40vh;
    overflow-y: auto;
    border-right: none !important;
    border-bottom: 1px solid var(--c-border);
  }

  /* Hide trip section on mobile by default */
  .trip-section {
    display: none;
  }
}

@media (max-width: 480px) {
  /* KPI cards: 1 across on very small screens */
  .row.g-3 > [class*="col-6"],
  .row.g-3 > [class*="col-md"] {
    flex: 0 0 100%;
    max-width: 100%;
  }
}
```

- [ ] **Step 2: Add `table-responsive-mobile` class to all table wrappers**

In each component (FuelLog, ExpenseTracker, MaintenanceTracker, DriverManager, AlertsCenter), find:

```tsx
<div className="table-responsive">
```

Replace with:

```tsx
<div className="table-responsive table-responsive-mobile">
```

- [ ] **Step 3: Type-check, visual verify on narrow viewport**

```powershell
npx tsc --noEmit
```

In the browser, open DevTools → toggle device toolbar → set to 375px wide. Sidebar should disappear (hamburger shows it), tables should scroll horizontally, KPI cards should stack.

- [ ] **Step 4: Commit**

```powershell
git add src/App.css src/components/FuelLog.tsx src/components/ExpenseTracker.tsx src/components/MaintenanceTracker.tsx src/components/DriverManager.tsx src/components/AlertsCenter.tsx
git commit -m "feat: mobile responsive layout — sidebar overlay, table scroll, card stacking"
```

---

## Task 18: Final type-check and full visual tour

- [ ] **Step 1: Full type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Build check**

```powershell
npm run build
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 3: Visual tour**

Start dev server (`npm run dev`) and verify each route:

| Route | What to check |
|---|---|
| `/` | Map tiles load, offline overlay visible, no white screen |
| `/dashboard` | StatCard minimal dark style, Rs. on fuel cost |
| `/drivers` | StatCard, EmptyState with icon |
| `/maintenance` | StatCard, Rs. on costs, EmptyState |
| `/fuel` | StatCard, Rs. on costs, EmptyState |
| `/expenses` | StatCard, Rs. on amounts, EmptyState |
| `/alerts` | StatCard, idle category visible, EmptyState checkmark |
| `/reports` | Preset buttons (Today/This Week/This Month/Custom) |
| Nav sidebar | Red pulsing offline card when disconnected |
| Mobile 375px | Sidebar slides in on hamburger, tables scroll |

- [ ] **Step 4: Final commit**

```powershell
git add -A
git commit -m "feat: complete UI improvements — all 4 clusters implemented"
```
