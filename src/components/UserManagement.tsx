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
    if (myRole === "fleet_manager" && (role === "admin" || role === "fleet_manager")) return false;
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
    const role = getUserRole(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: role === "admin" ? "fleet_manager" : (role as "fleet_manager" | "driver"),
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

  const toggleDeviceAssign = (traccarId: number) => {
    setFormData((prev) => ({
      ...prev,
      assignedDeviceIds: prev.assignedDeviceIds.includes(traccarId)
        ? prev.assignedDeviceIds.filter((id) => id !== traccarId)
        : [...prev.assignedDeviceIds, traccarId],
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">User Management</h1>
        <button className="btn btn-primary" onClick={handleOpenAdd}>+ Add User</button>
      </div>

      {toast && (
        <div className={`alert alert-${toast.type} alert-dismissible`} role="alert">
          {toast.text}
          <button type="button" className="btn-close" onClick={() => setToast(null)} />
        </div>
      )}

      <div className="row g-3 mb-4">
        {(
          [
            { label: "Fleet Managers", value: managerCount, color: "var(--c-accent)" as string | undefined },
            { label: "Drivers", value: driverCount, color: "#8b5cf6" as string | undefined },
            { label: "Total Users", value: users.length, color: undefined as string | undefined },
          ] as { label: string; value: number; color?: string }[]
        ).map((c) => (
          <div key={c.label} className="col-4">
            <StatCard label={c.label} value={c.value} color={c.color} />
          </div>
        ))}
      </div>

      <div className="card mb-4">
        <div className="card-body py-2">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <span className="text-muted small fw-semibold">Filter:</span>
            {(["all", "fleet_manager", "driver"] as const).map((r) => (
              <button
                key={r}
                className={`btn btn-sm ${filterRole === r ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setFilterRole(r)}
              >
                {r === "all" ? "All" : ROLE_LABEL[r as TrackMeRole]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border spinner-border-sm me-2" />Loading users…
            </div>
          ) : (
            <div className="table-responsive table-responsive-mobile">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Role</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.length === 0 ? (
                    <tr><td colSpan={4}>
                      <EmptyState
                        icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                        title="No users yet"
                        message="Add fleet managers and drivers to get started."
                        action={{ label: "+ Add User", onClick: handleOpenAdd }}
                      />
                    </td></tr>
                  ) : pagedUsers.map((user) => {
                    const role = getUserRole(user);
                    return (
                      <tr key={user.id}>
                        <td className="fw-semibold">{user.name}</td>
                        <td className="text-muted">{user.email}</td>
                        <td>
                          <span className="badge" style={{ background: `${ROLE_COLOR[role]}22`, color: ROLE_COLOR[role], border: `1px solid ${ROLE_COLOR[role]}44` }}>
                            {ROLE_LABEL[role]}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-sm btn-outline-primary me-1" onClick={() => handleOpenEdit(user)} disabled={role === "admin"}>Edit</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(user)} disabled={role === "admin"}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </div>
          )}
        </div>
      </div>

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
                        <input className={`form-control ${errors.name ? "is-invalid" : ""}`} name="name" value={formData.name} onChange={handleChange} placeholder="Ahmed Khan" />
                        {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Email (Traccar login) *</label>
                        <input type="email" className={`form-control ${errors.email ? "is-invalid" : ""}`} name="email" value={formData.email} onChange={handleChange} placeholder="user@company.com" />
                        {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">{editingUser ? "New Password (leave blank to keep)" : "Temporary Password *"}</label>
                        <input type="password" className={`form-control ${errors.password ? "is-invalid" : ""}`} name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" />
                        {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Role *</label>
                        <div className="d-flex gap-2">
                          {(["fleet_manager", "driver"] as const).map((r) => (
                            <button key={r} type="button"
                              className={`btn btn-sm flex-fill ${formData.role === r ? "btn-primary" : "btn-outline-secondary"}`}
                              onClick={() => setFormData((prev) => ({ ...prev, role: r, assignedGroupIds: [], assignedDeviceIds: [] }))}>
                              {ROLE_LABEL[r]}
                            </button>
                          ))}
                        </div>
                      </div>
                      {formData.role === "fleet_manager" && groups.length > 0 && (
                        <div className="col-12">
                          <label className="form-label fw-semibold">Assign to Fleets</label>
                          <div className="d-flex flex-wrap gap-2">
                            {groups.map((g) => (
                              <button key={g.id} type="button"
                                className={`btn btn-sm ${formData.assignedGroupIds.includes(g.id) ? "btn-primary" : "btn-outline-secondary"}`}
                                onClick={() => toggleGroupAssign(g.id)}>{g.name}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {formData.role === "driver" && devices.length > 0 && (
                        <div className="col-12">
                          <label className="form-label fw-semibold">Assign to Vehicles</label>
                          <div className="d-flex flex-wrap gap-2">
                            {devices.map((d) => (
                              <button key={d.id} type="button"
                                className={`btn btn-sm ${d.traccarId && formData.assignedDeviceIds.includes(d.traccarId) ? "btn-primary" : "btn-outline-secondary"}`}
                                onClick={() => d.traccarId && toggleDeviceAssign(d.traccarId)}>{d.name}</button>
                            ))}
                          </div>
                          <div className="text-muted small mt-1">Multiple vehicles can be assigned. One vehicle can have multiple drivers.</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : editingUser ? "Save Changes" : "Create User"}</button>
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
