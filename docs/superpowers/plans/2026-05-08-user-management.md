# User Management & RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-based access control to TrackMe — Admin/Fleet Manager/Driver roles stored as Traccar user attributes, with a `/users` management page and role-conditional navigation.

**Architecture:** All user data lives in Traccar (no new backend). Roles are stored as `user.attributes.trackme_role`. A new `userService.ts` orchestrates Traccar user + permission API calls. Role is cached in localStorage on login for synchronous reads in Navigation. Traccar's permission system enforces data scoping server-side (drivers only see their assigned devices).

**Tech Stack:** React 19, TypeScript, Bootstrap 5 CSS, Traccar REST API (`/api/users`, `/api/groups`, `/api/permissions`). Existing patterns: Bootstrap modal, StatCard, EmptyState, Pagination, usePagination, toast auto-dismiss.

---

## Files Created

| File | Purpose |
|---|---|
| `src/types/user.ts` | TraccarUser, TraccarGroup, TrackMeRole, UserFormData types |
| `src/services/userService.ts` | Role cache, user CRUD orchestration, permission helpers |
| `src/components/UserManagement.tsx` | `/users` page — Admin + Fleet Manager |
| `src/components/GroupManagement.tsx` | `/groups` page — Admin only (fleet CRUD) |

## Files Modified

| File | Changes |
|---|---|
| `src/services/traccarService.ts` | Add user, group, permission API functions + role caching on init |
| `src/components/Navigation.tsx` | Role-conditional nav items (Users, Fleets) |
| `src/App.tsx` | Add `/users` and `/groups` routes |
| `src/types/driver.ts` | Add optional `traccarUserId?: number` field |
| `src/components/DriverManager.tsx` | Add "Link Account" column + link Traccar user modal |
| `src/components/AdminPanel.tsx` | Add "Assigned Drivers" column + manage drivers modal |

---

## Task 1: User types

**Files:**
- Create: `src/types/user.ts`

- [ ] **Step 1: Create `src/types/user.ts`**

```typescript
export type TrackMeRole = "admin" | "fleet_manager" | "driver";

export interface TraccarUser {
  id: number;
  name: string;
  email: string;
  admin: boolean;
  disabled?: boolean;
  attributes: {
    trackme_role?: TrackMeRole;
    [key: string]: unknown;
  };
}

export interface TraccarGroup {
  id: number;
  name: string;
  groupId?: number; // parent group
  attributes?: Record<string, unknown>;
}

export interface PermissionLink {
  userId?: number;
  deviceId?: number;
  groupId?: number;
}

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: "fleet_manager" | "driver";
  assignedGroupIds: number[];    // fleet manager → groups
  assignedDeviceIds: number[];   // driver → devices (many-to-many)
}

export const ROLE_LABEL: Record<TrackMeRole, string> = {
  admin: "Admin",
  fleet_manager: "Fleet Manager",
  driver: "Driver",
};

export const ROLE_COLOR: Record<TrackMeRole, string> = {
  admin: "#f59e0b",
  fleet_manager: "#3b82f6",
  driver: "#8b5cf6",
};
```

- [ ] **Step 2: Type-check**

```powershell
cd C:\trackme && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```powershell
git add src/types/user.ts
git commit -m "feat: add TraccarUser, TraccarGroup, TrackMeRole types"
```

---

## Task 2: Traccar service — user, group, permission API functions

**Files:**
- Modify: `src/services/traccarService.ts`

> `traccarFetch` is a module-private function in traccarService.ts. Add all Traccar user/group/permission calls directly to this file so they share the same auth and proxy config.

- [ ] **Step 1: Add TraccarUser and TraccarGroup imports at top of `traccarService.ts`**

After the existing imports, add:

```typescript
import type { TraccarUser, TraccarGroup, PermissionLink } from "../types/user";
```

- [ ] **Step 2: Add getCurrentTraccarUser function**

After `isTraccarConfigured`, add:

```typescript
export const getCurrentTraccarUser = async (): Promise<TraccarUser | null> => {
  try {
    const res = await traccarFetch("session");
    if (!res.ok) return null;
    return res.json() as Promise<TraccarUser>;
  } catch {
    return null;
  }
};
```

- [ ] **Step 3: Add user CRUD functions**

```typescript
export const getTraccarUsers = async (): Promise<TraccarUser[]> => {
  const res = await traccarFetch("users");
  if (!res.ok) return [];
  return res.json() as Promise<TraccarUser[]>;
};

export const createTraccarUser = async (data: {
  name: string;
  email: string;
  password: string;
  attributes: Record<string, unknown>;
}): Promise<TraccarUser> => {
  const res = await traccarFetch("users", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create user: ${text}`);
  }
  return res.json() as Promise<TraccarUser>;
};

export const updateTraccarUser = async (
  id: number,
  data: Partial<{ name: string; email: string; password: string; attributes: Record<string, unknown> }>
): Promise<TraccarUser> => {
  const current = await traccarFetch(`users/${id}`).then((r) => r.json()) as TraccarUser;
  const res = await traccarFetch(`users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...current, ...data }),
  });
  if (!res.ok) throw new Error("Failed to update user");
  return res.json() as Promise<TraccarUser>;
};

export const deleteTraccarUser = async (id: number): Promise<void> => {
  const res = await traccarFetch(`users/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete user");
};
```

- [ ] **Step 4: Add group CRUD functions**

```typescript
export const getTraccarGroups = async (): Promise<TraccarGroup[]> => {
  const res = await traccarFetch("groups");
  if (!res.ok) return [];
  return res.json() as Promise<TraccarGroup[]>;
};

export const createTraccarGroup = async (name: string): Promise<TraccarGroup> => {
  const res = await traccarFetch("groups", {
    method: "POST",
    body: JSON.stringify({ name, attributes: {} }),
  });
  if (!res.ok) throw new Error("Failed to create group");
  return res.json() as Promise<TraccarGroup>;
};

export const updateTraccarGroup = async (id: number, name: string): Promise<TraccarGroup> => {
  const res = await traccarFetch(`groups/${id}`, {
    method: "PUT",
    body: JSON.stringify({ id, name, attributes: {} }),
  });
  if (!res.ok) throw new Error("Failed to update group");
  return res.json() as Promise<TraccarGroup>;
};

export const deleteTraccarGroup = async (id: number): Promise<void> => {
  const res = await traccarFetch(`groups/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete group");
};
```

- [ ] **Step 5: Add permission functions**

```typescript
export const addTraccarPermission = async (link: PermissionLink): Promise<void> => {
  const res = await traccarFetch("permissions", {
    method: "POST",
    body: JSON.stringify(link),
  });
  if (!res.ok) throw new Error("Failed to add permission");
};

export const removeTraccarPermission = async (link: PermissionLink): Promise<void> => {
  const res = await traccarFetch("permissions", {
    method: "DELETE",
    body: JSON.stringify(link),
  });
  if (!res.ok) throw new Error("Failed to remove permission");
};
```

- [ ] **Step 6: Cache role on initializeTraccar success**

Find `initializeTraccar` and add role caching after `localStorage.setItem("traccar_config", ...)`:

```typescript
// After: localStorage.setItem("traccar_config", JSON.stringify(config));
// Add:
const user = await getCurrentTraccarUser();
if (user) {
  const role = user.admin ? "admin" : (user.attributes.trackme_role ?? null);
  if (role) localStorage.setItem("trackme_current_role", role as string);
}
```

Also add to `disconnectTraccar` (or wherever logout happens — search for it):

```typescript
localStorage.removeItem("trackme_current_role");
```

- [ ] **Step 7: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```powershell
git add src/services/traccarService.ts src/types/user.ts
git commit -m "feat: add Traccar user/group/permission API functions, cache role on login"
```

---

## Task 3: userService.ts — orchestration layer

**Files:**
- Create: `src/services/userService.ts`

- [ ] **Step 1: Create `src/services/userService.ts`**

```typescript
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

  // Assign to groups (fleet manager only)
  for (const groupId of data.assignedGroupIds) {
    await addTraccarPermission({ userId: user.id, groupId });
  }

  // Assign to devices (driver only)
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

  // Sync group permissions
  for (const gId of previousGroupIds) {
    if (!data.assignedGroupIds.includes(gId))
      await removeTraccarPermission({ userId: id, groupId: gId });
  }
  for (const gId of data.assignedGroupIds) {
    if (!previousGroupIds.includes(gId))
      await addTraccarPermission({ userId: id, groupId: gId });
  }

  // Sync device permissions
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
```

- [ ] **Step 2: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```powershell
git add src/services/userService.ts
git commit -m "feat: add userService — role cache, user CRUD with permission sync"
```

---

## Task 4: UserManagement component

**Files:**
- Create: `src/components/UserManagement.tsx`

> Follows existing patterns exactly: Bootstrap modal (no JS), toast auto-dismiss, StatCard, EmptyState, Pagination, usePagination. Read AdminPanel.tsx and DriverManager.tsx for reference.

- [ ] **Step 1: Create `src/components/UserManagement.tsx`**

```tsx
import { useState, useEffect } from "react";
import { getAllUsers, createUser, updateUser, deleteUser, getUserRole, getMyRole } from "../services/userService";
import { getTraccarGroups } from "../services/traccarService";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import type { TraccarUser, UserFormData, TrackMeRole } from "../types/user";
import type { Device } from "../types/device";
import type { TraccarGroup } from "../types/user";
import { ROLE_LABEL, ROLE_COLOR } from "../types/user";
import StatCard from "./StatCard";
import EmptyState from "./EmptyState";
import Pagination from "./Pagination";
import { usePagination } from "../hooks/usePagination";

const EMPTY_FORM: UserFormData = {
  name: "",
  email: "",
  password: "",
  role: "driver",
  assignedGroupIds: [],
  assignedDeviceIds: [],
};

const UserManagement = () => {
  const [users, setUsers] = useState<TraccarUser[]>([]);
  const [groups, setGroups] = useState<TraccarGroup[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<TrackMeRole | "all">("all");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<TraccarUser | null>(null);
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  const myRole = getMyRole();

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [u, g, d] = await Promise.all([
        getAllUsers(),
        getTraccarGroups(),
        getAllDevicesWithTraccar(),
      ]);
      setUsers(u);
      setGroups(g);
      setDevices(d);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const role = getUserRole(u);
    if (filterRole !== "all" && role !== filterRole) return false;
    // Fleet managers only see their drivers (server enforces data, we filter admin out of view)
    if (myRole === "fleet_manager" && role === "admin") return false;
    if (myRole === "fleet_manager" && role === "fleet_manager" && !u.admin) {
      // hide other fleet managers from fleet manager view
      return false;
    }
    return true;
  });

  const { page, totalPages, paged: pagedUsers, setPage } = usePagination(filteredUsers);
  useEffect(() => { setPage(1); }, [filterRole]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = "Name is required.";
    if (!formData.email.trim()) e.email = "Email is required.";
    if (!editingUser && !formData.password.trim()) e.password = "Password is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (user: TraccarUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: getUserRole(user) === "admin" ? "fleet_manager" : (getUserRole(user) as "fleet_manager" | "driver"),
      assignedGroupIds: [],
      assignedDeviceIds: [],
    });
    setErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, formData, [], []);
        setToast({ type: "success", text: "User updated." });
      } else {
        await createUser(formData);
        setToast({ type: "success", text: "User created." });
      }
      setShowModal(false);
      await loadAll();
    } catch (err) {
      setToast({ type: "danger", text: err instanceof Error ? err.message : "Failed to save user." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: TraccarUser) => {
    if (!confirm(`Delete user "${user.name}"? This removes their Traccar account.`)) return;
    try {
      await deleteUser(user.id);
      setToast({ type: "success", text: "User deleted." });
      await loadAll();
    } catch {
      setToast({ type: "danger", text: "Failed to delete user." });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const toggleDeviceAssign = (deviceId: number) => {
    setFormData((prev) => ({
      ...prev,
      assignedDeviceIds: prev.assignedDeviceIds.includes(deviceId)
        ? prev.assignedDeviceIds.filter((id) => id !== deviceId)
        : [...prev.assignedDeviceIds, deviceId],
    }));
  };

  const toggleGroupAssign = (groupId: number) => {
    setFormData((prev) => ({
      ...prev,
      assignedGroupIds: prev.assignedGroupIds.includes(groupId)
        ? prev.assignedGroupIds.filter((id) => id !== groupId)
        : [...prev.assignedGroupIds, groupId],
    }));
  };

  const managerCount = users.filter((u) => getUserRole(u) === "fleet_manager").length;
  const driverCount = users.filter((u) => getUserRole(u) === "driver").length;

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">User Management</h1>
        <button className="btn btn-primary" onClick={handleOpenAdd}>+ Add User</button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`alert alert-${toast.type} alert-dismissible`} role="alert">
          {toast.text}
          <button type="button" className="btn-close" onClick={() => setToast(null)} />
        </div>
      )}

      {/* KPI cards */}
      <div className="row g-3 mb-4">
        {[
          { label: "Fleet Managers", value: managerCount, color: "var(--c-accent)" },
          { label: "Drivers", value: driverCount, color: "#8b5cf6" },
          { label: "Total Users", value: users.length },
        ].map((c) => (
          <div key={c.label} className="col-4">
            <StatCard label={c.label} value={c.value} color={c.color} />
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="card mb-4">
        <div className="card-body py-2">
          <div className="d-flex gap-2 align-items-center">
            <span className="text-muted small fw-semibold">Filter:</span>
            {(["all", "fleet_manager", "driver"] as const).map((r) => (
              <button
                key={r}
                className={`btn btn-sm ${filterRole === r ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setFilterRole(r)}
              >
                {r === "all" ? "All" : ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border spinner-border-sm me-2" />
              Loading users…
            </div>
          ) : (
            <div className="table-responsive table-responsive-mobile">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Assigned To</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon={
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                          }
                          title="No users yet"
                          message="Add fleet managers and drivers to get started."
                          action={{ label: "+ Add User", onClick: handleOpenAdd }}
                        />
                      </td>
                    </tr>
                  ) : (
                    pagedUsers.map((user) => {
                      const role = getUserRole(user);
                      return (
                        <tr key={user.id}>
                          <td className="fw-semibold">{user.name}</td>
                          <td className="text-muted">{user.email}</td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: `${ROLE_COLOR[role]}22`,
                                color: ROLE_COLOR[role],
                                border: `1px solid ${ROLE_COLOR[role]}44`,
                              }}
                            >
                              {ROLE_LABEL[role]}
                            </span>
                          </td>
                          <td className="text-muted small">—</td>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-primary me-1"
                              onClick={() => handleOpenEdit(user)}
                              disabled={role === "admin"}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(user)}
                              disabled={role === "admin"}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <>
          <div className="modal fade show" style={{ display: "block" }} tabIndex={-1}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <form onSubmit={handleSubmit}>
                  <div className="modal-header">
                    <h5 className="modal-title">{editingUser ? "Edit User" : "Add New User"}</h5>
                    <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                  </div>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Full Name *</label>
                        <input
                          className={`form-control ${errors.name ? "is-invalid" : ""}`}
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Ahmed Khan"
                        />
                        {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Email (Traccar login) *</label>
                        <input
                          type="email"
                          className={`form-control ${errors.email ? "is-invalid" : ""}`}
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="user@company.com"
                        />
                        {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          {editingUser ? "New Password (leave blank to keep)" : "Temporary Password *"}
                        </label>
                        <input
                          type="password"
                          className={`form-control ${errors.password ? "is-invalid" : ""}`}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="••••••••"
                        />
                        {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Role *</label>
                        <div className="d-flex gap-2">
                          {(["fleet_manager", "driver"] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              className={`btn btn-sm flex-fill ${formData.role === r ? "btn-primary" : "btn-outline-secondary"}`}
                              onClick={() => setFormData((prev) => ({ ...prev, role: r, assignedGroupIds: [], assignedDeviceIds: [] }))}
                            >
                              {ROLE_LABEL[r]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Fleet Manager: assign to groups */}
                      {formData.role === "fleet_manager" && groups.length > 0 && (
                        <div className="col-12">
                          <label className="form-label fw-semibold">Assign to Fleets</label>
                          <div className="d-flex flex-wrap gap-2">
                            {groups.map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                className={`btn btn-sm ${formData.assignedGroupIds.includes(g.id) ? "btn-primary" : "btn-outline-secondary"}`}
                                onClick={() => toggleGroupAssign(g.id)}
                              >
                                {g.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Driver: assign to devices */}
                      {formData.role === "driver" && devices.length > 0 && (
                        <div className="col-12">
                          <label className="form-label fw-semibold">Assign to Vehicles</label>
                          <div className="d-flex flex-wrap gap-2">
                            {devices.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                className={`btn btn-sm ${formData.assignedDeviceIds.includes(d.traccarId ?? -1) ? "btn-primary" : "btn-outline-secondary"}`}
                                onClick={() => d.traccarId && toggleDeviceAssign(d.traccarId)}
                              >
                                {d.name}
                              </button>
                            ))}
                          </div>
                          <div className="text-muted small mt-1">Multiple vehicles can be assigned. One vehicle can have multiple drivers.</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? "Saving…" : editingUser ? "Save Changes" : "Create User"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowModal(false)} />
        </>
      )}
    </div>
  );
};

export default UserManagement;
```

- [ ] **Step 2: Type-check**

```powershell
npx tsc --noEmit
```

Fix any type errors before proceeding.

- [ ] **Step 3: Commit**

```powershell
git add src/components/UserManagement.tsx
git commit -m "feat: add UserManagement page — create/edit/delete Traccar users with roles"
```

---

## Task 5: GroupManagement component

**Files:**
- Create: `src/components/GroupManagement.tsx`

- [ ] **Step 1: Create `src/components/GroupManagement.tsx`**

```tsx
import { useState, useEffect } from "react";
import { getTraccarGroups, createTraccarGroup, updateTraccarGroup, deleteTraccarGroup } from "../services/traccarService";
import type { TraccarGroup } from "../types/user";
import StatCard from "./StatCard";
import EmptyState from "./EmptyState";

const GroupManagement = () => {
  const [groups, setGroups] = useState<TraccarGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TraccarGroup | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  useEffect(() => { loadGroups(); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadGroups = async () => {
    setLoading(true);
    try { setGroups(await getTraccarGroups()); }
    finally { setLoading(false); }
  };

  const handleOpenAdd = () => { setEditingGroup(null); setName(""); setNameError(""); setShowModal(true); };
  const handleOpenEdit = (g: TraccarGroup) => { setEditingGroup(g); setName(g.name); setNameError(""); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError("Fleet name is required."); return; }
    setSaving(true);
    try {
      if (editingGroup) {
        await updateTraccarGroup(editingGroup.id, name.trim());
        setToast({ type: "success", text: "Fleet updated." });
      } else {
        await createTraccarGroup(name.trim());
        setToast({ type: "success", text: "Fleet created." });
      }
      setShowModal(false);
      await loadGroups();
    } catch {
      setToast({ type: "danger", text: "Failed to save fleet." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: TraccarGroup) => {
    if (!confirm(`Delete fleet "${g.name}"?`)) return;
    try {
      await deleteTraccarGroup(g.id);
      setToast({ type: "success", text: "Fleet deleted." });
      await loadGroups();
    } catch {
      setToast({ type: "danger", text: "Failed to delete fleet." });
    }
  };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Fleet Management</h1>
        <button className="btn btn-primary" onClick={handleOpenAdd}>+ Add Fleet</button>
      </div>

      {toast && (
        <div className={`alert alert-${toast.type} alert-dismissible`} role="alert">
          {toast.text}
          <button type="button" className="btn-close" onClick={() => setToast(null)} />
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-4">
          <StatCard label="Total Fleets" value={groups.length} color="var(--c-accent)" />
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border spinner-border-sm me-2" />Loading fleets…</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>Fleet Name</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr><td colSpan={2}>
                      <EmptyState
                        icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>}
                        title="No fleets yet"
                        message="Create a fleet to group devices and assign fleet managers."
                        action={{ label: "+ Add Fleet", onClick: handleOpenAdd }}
                      />
                    </td></tr>
                  ) : (
                    groups.map((g) => (
                      <tr key={g.id}>
                        <td className="fw-semibold">{g.name}</td>
                        <td>
                          <button className="btn btn-sm btn-outline-primary me-1" onClick={() => handleOpenEdit(g)}>Rename</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(g)}>Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <>
          <div className="modal fade show" style={{ display: "block" }} tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <form onSubmit={handleSubmit}>
                  <div className="modal-header">
                    <h5 className="modal-title">{editingGroup ? "Rename Fleet" : "Add New Fleet"}</h5>
                    <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                  </div>
                  <div className="modal-body">
                    <label className="form-label fw-semibold">Fleet Name *</label>
                    <input
                      className={`form-control ${nameError ? "is-invalid" : ""}`}
                      value={name}
                      onChange={(e) => { setName(e.target.value); setNameError(""); }}
                      placeholder="e.g. Karachi Fleet"
                      autoFocus
                    />
                    {nameError && <div className="invalid-feedback">{nameError}</div>}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? "Saving…" : editingGroup ? "Save" : "Create Fleet"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowModal(false)} />
        </>
      )}
    </div>
  );
};

export default GroupManagement;
```

- [ ] **Step 2: Type-check and commit**

```powershell
npx tsc --noEmit
git add src/components/GroupManagement.tsx
git commit -m "feat: add GroupManagement page — fleet (Traccar group) CRUD"
```

---

## Task 6: Navigation — role-conditional items

**Files:**
- Modify: `src/components/Navigation.tsx`

> `getMyRole()` is synchronous (reads localStorage). Navigation re-reads on every render — no useEffect needed.

- [ ] **Step 1: Add import to `Navigation.tsx`**

At the top of the file, after existing imports:

```tsx
import { getMyRole, canManageUsers, isAdmin } from "../services/userService";
```

- [ ] **Step 2: Add role to component body**

Inside the `Navigation` component, after `const connected = isTraccarConfigured();`:

```tsx
const myRole = getMyRole();
```

- [ ] **Step 3: Update NAV_GROUPS to include conditional items**

The `NAV_GROUPS` constant is defined outside the component. Move the dynamic items inside the component as a computed value instead. Replace the `NAV_GROUPS` static const and `nav.map()` with a computed version:

Add inside the component (after `const myRole = getMyRole()`):

```tsx
const navGroups = [
  {
    label: "Live",
    items: [
      { to: "/", label: "Map View", icon: Icons.map },
      { to: "/dashboard", label: "Dashboard", icon: Icons.dashboard },
    ],
  },
  {
    label: "Fleet",
    items: [
      { to: "/admin", label: "Devices", icon: Icons.devices },
      { to: "/drivers", label: "Drivers", icon: Icons.drivers },
      { to: "/geofences", label: "Geofences", icon: Icons.geofences },
      ...(canManageUsers() ? [{ to: "/users", label: "Users", icon: Icons.drivers }] : []),
      ...(isAdmin() ? [{ to: "/groups", label: "Fleets", icon: Icons.dashboard }] : []),
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/maintenance", label: "Maintenance", icon: Icons.maintenance },
      { to: "/fuel", label: "Fuel Log", icon: Icons.fuel },
      { to: "/expenses", label: "Expenses", icon: Icons.expenses },
      { to: "/reports", label: "Reports", icon: Icons.reports },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/alerts", label: "Alerts", icon: Icons.alerts },
      { to: "/traccar", label: "Traccar", icon: Icons.plug },
    ],
  },
];
```

Then in the JSX, replace `NAV_GROUPS.map(...)` with `navGroups.map(...)`.

Also remove the `NAV_GROUPS` const that was outside the component (it's now replaced by `navGroups` inside).

- [ ] **Step 4: Type-check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```powershell
git add src/components/Navigation.tsx
git commit -m "feat: navigation shows Users and Fleets links based on role"
```

---

## Task 7: App.tsx — new routes

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports to `App.tsx`**

```tsx
import UserManagement from "./components/UserManagement";
import GroupManagement from "./components/GroupManagement";
```

- [ ] **Step 2: Add routes inside `<Routes>`**

After the existing routes, before `<Route path="*" ...>`:

```tsx
<Route path="/users" element={<ErrorBoundary><UserManagement /></ErrorBoundary>} />
<Route path="/groups" element={<ErrorBoundary><GroupManagement /></ErrorBoundary>} />
```

- [ ] **Step 3: Type-check and commit**

```powershell
npx tsc --noEmit
git add src/App.tsx
git commit -m "feat: add /users and /groups routes"
```

---

## Task 8: Update driver types + DriverManager — link to Traccar accounts

**Files:**
- Modify: `src/types/driver.ts`
- Modify: `src/components/DriverManager.tsx`

- [ ] **Step 1: Add `traccarUserId` to driver types**

In `src/types/driver.ts`, add the field to both interfaces:

```typescript
export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  licenseExpiry: string;
  phone: string;
  email: string;
  assignedDeviceId: string | null;
  notes: string;
  traccarUserId?: number;   // ← add this
  createdAt: string;
  updatedAt: string;
}

export interface DriverFormData {
  name: string;
  licenseNumber: string;
  licenseExpiry: string;
  phone: string;
  email: string;
  assignedDeviceId: string;
  notes: string;
  traccarUserId?: number;   // ← add this
}
```

- [ ] **Step 2: Add "Traccar Account" column to DriverManager table**

In `src/components/DriverManager.tsx`, add import:

```tsx
import { getAllUsers } from "../services/userService";
import type { TraccarUser } from "../types/user";
```

Add state:

```tsx
const [traccarUsers, setTraccarUsers] = useState<TraccarUser[]>([]);
```

In `loadAll`, also load Traccar users:

```tsx
const loadAll = async () => {
  setLoading(true);
  try {
    setDrivers(getAllDrivers());
    const [devs, users] = await Promise.all([
      getAllDevicesWithTraccar(),
      getAllUsers().catch(() => [] as TraccarUser[]),
    ]);
    setDevices(devs);
    setTraccarUsers(users);
  } finally {
    setLoading(false);
  }
};
```

Add a helper after the state declarations:

```tsx
const getLinkedUser = (driver: Driver): TraccarUser | undefined =>
  driver.traccarUserId ? traccarUsers.find((u) => u.id === driver.traccarUserId) : undefined;
```

In the table `<thead>`, add a column header after "ASSIGNED VEHICLE":

```tsx
<th>Traccar Account</th>
```

In the table row (inside `pagedDrivers.map`), add a cell after the assigned vehicle cell:

```tsx
<td>
  {(() => {
    const linked = getLinkedUser(driver);
    return linked ? (
      <span className="badge" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
        ✓ {linked.email}
      </span>
    ) : (
      <span className="text-muted small">Not linked</span>
    );
  })()}
</td>
```

- [ ] **Step 3: Type-check and commit**

```powershell
npx tsc --noEmit
git add src/types/driver.ts src/components/DriverManager.tsx
git commit -m "feat: driver records show linked Traccar account status"
```

---

## Task 9: AdminPanel — assigned drivers per device

**Files:**
- Modify: `src/components/AdminPanel.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { getAllUsers, assignDriverToDevice, removeDriverFromDevice } from "../services/userService";
import type { TraccarUser } from "../types/user";
```

- [ ] **Step 2: Add state**

```tsx
const [traccarUsers, setTraccarUsers] = useState<TraccarUser[]>([]);
const [driverModal, setDriverModal] = useState<{ device: Device } | null>(null);
```

- [ ] **Step 3: Load users in loadDevices**

In `loadDevices`, add user loading:

```tsx
const loadDevices = async () => {
  setLoading(true);
  try {
    const [devs, users] = await Promise.all([
      getAllDevicesWithTraccar(),
      getAllUsers().catch(() => [] as TraccarUser[]),
    ]);
    setDevices(devs);
    setTraccarUsers(users);
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 4: Add "Drivers" column to device table**

In the table `<thead>`, add after the last column header before "Actions":

```tsx
<th>Drivers</th>
```

In the device row, add a cell:

```tsx
<td>
  <button
    className="btn btn-sm btn-outline-secondary"
    onClick={() => setDriverModal({ device })}
  >
    Manage Drivers
  </button>
</td>
```

- [ ] **Step 5: Add Driver Assignment Modal**

After the existing Add/Edit device modal, add:

```tsx
{driverModal && (
  <>
    <div className="modal fade show" style={{ display: "block" }} tabIndex={-1}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Drivers — {driverModal.device.name}</h5>
            <button type="button" className="btn-close" onClick={() => setDriverModal(null)} />
          </div>
          <div className="modal-body">
            <p className="text-muted small mb-3">
              Multiple drivers can be assigned to one vehicle. One driver can also be assigned to multiple vehicles.
            </p>
            {traccarUsers
              .filter((u) => u.attributes.trackme_role === "driver")
              .map((user) => (
                <div key={user.id} className="d-flex align-items-center justify-content-between py-2 border-bottom">
                  <div>
                    <div className="fw-semibold">{user.name}</div>
                    <div className="text-muted small">{user.email}</div>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={async () => {
                      try {
                        const deviceId = driverModal.device.traccarId;
                        if (!deviceId) return;
                        await assignDriverToDevice(user.id, deviceId);
                        setToast({ type: "success", text: `${user.name} assigned to ${driverModal.device.name}.` });
                      } catch {
                        setToast({ type: "danger", text: "Failed to assign driver." });
                      }
                    }}
                  >
                    Assign
                  </button>
                </div>
              ))}
            {traccarUsers.filter((u) => u.attributes.trackme_role === "driver").length === 0 && (
              <p className="text-muted text-center py-3">No drivers found. Add drivers in User Management first.</p>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setDriverModal(null)}>Close</button>
          </div>
        </div>
      </div>
    </div>
    <div className="modal-backdrop fade show" onClick={() => setDriverModal(null)} />
  </>
)}
```

- [ ] **Step 6: Type-check and commit**

```powershell
npx tsc --noEmit
git add src/components/AdminPanel.tsx
git commit -m "feat: devices panel shows Manage Drivers modal — many-to-many assignment"
```

---

## Task 10: Final type-check + build + visual verify

- [ ] **Step 1: Full type-check**

```powershell
cd C:\trackme && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Build check**

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Start dev server and verify**

```powershell
npm run dev
```

Open `http://127.0.0.1:3001` and verify:

| What to check | Expected |
|---|---|
| Navigation (when Traccar connected as admin) | "Users" and "Fleets" appear under Fleet section |
| Navigation (when not connected) | Users and Fleets do NOT appear |
| `/users` | Page loads, KPI cards show, Add User opens modal with role selector |
| `/groups` | Page loads, Add Fleet opens modal |
| `/admin` (Devices) | "Manage Drivers" button appears per device row |
| `/drivers` | "Traccar Account" column shows "Not linked" or linked email |

- [ ] **Step 4: Final commit**

```powershell
git add -A
git status  # verify no unintended files
git commit -m "feat: user management + RBAC complete — roles, users, fleets, driver-device assignment"
```
