# User Management & RBAC Design

**Date:** 2026-05-08  
**Status:** Approved  
**Scope:** Web app Phase 1 — User Management + Role-Based Access Control

---

## Problem

TrackMe currently has no user accounts beyond the single Traccar admin login. All driver records are localStorage-only, with no login access. The system needs proper multi-user RBAC to support:
- Multiple fleet managers managing separate fleets
- Drivers logging into the mobile app with their own credentials
- Admin overseeing everything

---

## Role Hierarchy

```
Admin (Traccar admin flag = true)
  └── sees: all fleets, all fleet managers, all drivers, all vehicles
  └── can: create/edit/delete any user, assign fleet managers to fleets

Fleet Manager (trackme_role = "fleet_manager")
  └── sees: all drivers + vehicles in their own fleet only
  └── can: create/edit/delete drivers in their fleet, assign drivers to vehicles

Driver (trackme_role = "driver")
  └── sees: only vehicle(s) explicitly assigned to them
  └── can: log into mobile app, view their assigned vehicles
  └── note: one driver can be assigned to many vehicles, one vehicle to many drivers
```

---

## Architecture

**No extra backend required.** Traccar is the single source of truth for users, roles, and permissions.

| Concept | Traccar mechanism |
|---|---|
| User accounts | Traccar `/api/users` — each user has email + password |
| Role | `user.attributes.trackme_role` — `"fleet_manager"` or `"driver"` (admin = `user.admin = true`) |
| Fleet | Traccar **Group** — a named collection of devices |
| Fleet Manager → Fleet | Link fleet manager user to a Group via `/api/permissions` |
| Driver → Vehicle(s) | Link driver user to specific Device(s) via `/api/permissions` |
| What a user can see | Traccar enforces: users only see devices they have permission to |

### Permission model

```
Admin
  ├── GET /api/users → sees all users
  ├── GET /api/devices → sees all devices
  └── GET /api/groups → sees all groups (fleets)

Fleet Manager
  ├── GET /api/devices → sees only devices in their group
  ├── GET /api/users → sees only drivers in their group (filtered client-side by fleet)
  └── cannot see other fleet managers or other fleets

Driver
  ├── GET /api/devices → sees only their explicitly assigned device(s)
  └── cannot see other drivers or fleet data
```

---

## Web App Changes

### 1. New service: `src/services/userService.ts`

Wraps Traccar `/api/users` and `/api/permissions` endpoints.

Key exports:
- `getAllUsers(): Promise<TraccarUser[]>` — admin only
- `createUser(data: UserFormData): Promise<TraccarUser>` — creates Traccar account + sets `trackme_role` attribute
- `updateUser(id: number, data: UserFormData): Promise<TraccarUser>`
- `deleteUser(id: number): Promise<void>`
- `getMyRole(): "admin" | "fleet_manager" | "driver" | null` — reads from current session
- `assignUserToGroup(userId: number, groupId: number): Promise<void>` — fleet manager → fleet
- `assignUserToDevice(userId: number, deviceId: number): Promise<void>` — driver → vehicle
- `removeUserFromDevice(userId: number, deviceId: number): Promise<void>`
- `getDeviceUsers(deviceId: number): Promise<TraccarUser[]>` — drivers assigned to a device

### 2. New type: `src/types/user.ts`

```typescript
export type TrackMeRole = "admin" | "fleet_manager" | "driver";

export interface TraccarUser {
  id: number;
  name: string;
  email: string;
  admin: boolean;
  attributes: {
    trackme_role?: TrackMeRole;
    [key: string]: unknown;
  };
}

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: "fleet_manager" | "driver";
  assignedGroupId?: number;   // for fleet managers
  assignedDeviceIds?: number[]; // for drivers (many-to-many)
}
```

### 3. New component: `src/components/UserManagement.tsx`

Route: `/users` — visible in navigation only when `getMyRole() === "admin"`.

**Features:**
- StatCard KPI row: Fleet Managers count, Drivers count, Total Users
- Filterable table: Name, Email, Role badge, Assigned fleet/vehicle, Actions (Edit, Delete)
- Role filter dropdown: All / Fleet Managers / Drivers
- "Add User" button → modal
- Add/Edit modal fields:
  - Name (text)
  - Email (text — becomes Traccar login)
  - Password (text — temporary, user should change)
  - Role toggle: Fleet Manager | Driver
  - If Fleet Manager: multi-select dropdown of Groups (fleets) to assign
  - If Driver: multi-select dropdown of Devices to assign (many-to-many)
- Delete: removes from Traccar + removes all permissions
- Fleet Manager can access this page too, but sees only their drivers (not other fleet managers)

### 4. New component: `src/components/GroupManagement.tsx`

Route: `/groups` — Admin only. Manage Traccar Groups (fleets).

**Features:**
- List of groups with device count
- Create/rename/delete groups
- Assign devices to groups (drag-and-drop or multi-select)
- Simple — wraps Traccar `/api/groups` and `/api/permissions`

### 5. Update `src/components/Navigation.tsx`

Add new nav items under FLEET section, conditionally shown by role:
- "Users" (`/users`) — shown to Admin and Fleet Manager
- "Fleets" (`/groups`) — shown to Admin only

Role is read from `getMyRole()` on mount. Navigation re-renders on login/logout.

### 6. Update `src/App.tsx`

Add routes:
```tsx
<Route path="/users" element={<ErrorBoundary><UserManagement /></ErrorBoundary>} />
<Route path="/groups" element={<ErrorBoundary><GroupManagement /></ErrorBoundary>} />
```

### 7. Update `src/components/DriverManager.tsx`

- Add "Traccar Account" column showing whether driver has a linked Traccar user (`traccarUserId`)
- "Link Account" button — opens modal to select an existing Traccar user to link to this driver record
- This bridges the existing localStorage driver profiles with Traccar user accounts
- The `Driver` type gets a new optional field: `traccarUserId?: number`

### 8. Update `src/components/AdminPanel.tsx` (Devices)

- Add "Assigned Drivers" column showing driver names linked to each device
- Clicking opens a "Manage Drivers" sub-modal for that device: add/remove driver assignments (many-to-many)

### 9. Update `src/services/traccarService.ts`

Add:
- `getTraccarGroups(): Promise<TraccarGroup[]>`
- `createTraccarGroup(name: string): Promise<TraccarGroup>`
- `deleteTraccarGroup(id: number): Promise<void>`
- `getCurrentUser(): Promise<TraccarUser>` — from `/api/session`

---

## Permission Enforcement

Client-side role checks using `getMyRole()`:

| Page | Admin | Fleet Manager | Driver |
|---|---|---|---|
| Map | ✅ all devices | ✅ fleet devices only | ✅ assigned devices only |
| Dashboard | ✅ all | ✅ fleet | ❌ not shown |
| Devices (`/admin`) | ✅ full CRUD | ✅ read only | ❌ not shown |
| Users (`/users`) | ✅ full CRUD | ✅ own drivers only | ❌ not shown |
| Fleets (`/groups`) | ✅ full CRUD | ❌ not shown | ❌ not shown |
| Drivers | ✅ all | ✅ own fleet | ❌ not shown |
| Reports | ✅ all | ✅ fleet | ❌ not shown |
| Maintenance/Fuel/Expenses | ✅ all | ✅ fleet | ❌ not shown |

Note: Traccar API enforces server-side permission — even if a driver hits the API directly, Traccar only returns their own data. Client-side checks are for UX only (hiding irrelevant nav items).

---

## Mobile App (Phase 2 — separate spec)

The mobile app (React Native + Expo) reads `getMyRole()` on login and shows role-appropriate tabs:

**Admin / Fleet Manager tabs:** Map, Alerts, Dashboard, Settings  
**Driver tabs:** My Vehicle(s), Log Fuel, Log Expense, Settings

Mobile app does NOT include user management. All user/role administration happens on the web.

---

## Implementation Order

1. `src/types/user.ts` — TraccarUser type + TrackMeRole
2. `src/services/userService.ts` — user CRUD + permission management
3. Update `src/services/traccarService.ts` — add group endpoints + getCurrentUser
4. `src/components/UserManagement.tsx` — new page
5. `src/components/GroupManagement.tsx` — new page
6. Update `Navigation.tsx` — role-conditional nav items
7. Update `App.tsx` — new routes
8. Update `DriverManager.tsx` — link to Traccar accounts
9. Update `AdminPanel.tsx` — driver assignment per device
