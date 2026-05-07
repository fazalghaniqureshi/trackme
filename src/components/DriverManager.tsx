import { useState, useEffect } from "react";
import type { Driver, DriverFormData } from "../types/driver";
import type { Device } from "../types/device";
import {
  getAllDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
} from "../services/driverService";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import StatCard from './StatCard';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';

const EMPTY_FORM: DriverFormData = {
  name: "",
  licenseNumber: "",
  licenseExpiry: "",
  phone: "",
  email: "",
  assignedDeviceId: "",
  notes: "",
};

const daysUntil = (dateStr: string) =>
  Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);

const LicenseBadge = ({ expiry }: { expiry: string }) => {
  const days = daysUntil(expiry);
  if (days < 0) return <span className="badge bg-danger">Expired</span>;
  if (days <= 30)
    return (
      <span className="badge bg-warning text-dark">
        {expiry} ({days}d left)
      </span>
    );
  return <span className="badge bg-success">{expiry}</span>;
};

const DriverManager = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState<DriverFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadAll = async () => {
    setLoading(true);
    try {
      setDrivers(getAllDrivers());
      setDevices(await getAllDevicesWithTraccar());
    } finally {
      setLoading(false);
    }
  };

  const getDeviceName = (deviceId: string | null) => {
    if (!deviceId) return null;
    return devices.find((d) => d.id === deviceId)?.name ?? "Unknown Vehicle";
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = "Name is required.";
    if (!formData.licenseNumber.trim()) e.licenseNumber = "License number is required.";
    if (!formData.licenseExpiry) e.licenseExpiry = "Expiry date is required.";
    if (!formData.phone.trim()) e.phone = "Phone is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      e.email = "Valid email is required.";
    const duplicate = drivers.find(
      (d) =>
        d.licenseNumber.toLowerCase() === formData.licenseNumber.trim().toLowerCase() &&
        d.id !== editingDriver?.id
    );
    if (duplicate) e.licenseNumber = "License number already exists.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleOpenAdd = () => {
    setEditingDriver(null);
    setFormData(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name,
      licenseNumber: driver.licenseNumber,
      licenseExpiry: driver.licenseExpiry,
      phone: driver.phone,
      email: driver.email,
      assignedDeviceId: driver.assignedDeviceId ?? "",
      notes: driver.notes,
    });
    setErrors({});
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingDriver(null);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    if (editingDriver) {
      updateDriver(editingDriver.id, formData);
      setToast({ type: "success", text: `"${formData.name}" updated.` });
    } else {
      createDriver(formData);
      setToast({ type: "success", text: `"${formData.name}" added.` });
    }
    setSaving(false);
    handleClose();
    setDrivers(getAllDrivers());
  };

  const handleDelete = (driver: Driver) => {
    if (!window.confirm(`Delete driver "${driver.name}"?`)) return;
    deleteDriver(driver.id);
    setDrivers(getAllDrivers());
    setToast({ type: "success", text: `"${driver.name}" deleted.` });
  };

  const filteredDrivers = drivers;
  const { page, totalPages, paged: pagedDrivers, setPage } = usePagination(filteredDrivers);

  const assigned = drivers.filter((d) => d.assignedDeviceId).length;
  const expiringSoon = drivers.filter((d) => {
    const days = daysUntil(d.licenseExpiry);
    return days >= 0 && days <= 30;
  }).length;

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Driver Management</h1>
        <button className="btn btn-success" onClick={handleOpenAdd}>
          + Add Driver
        </button>
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
          { label: "Total Drivers", value: drivers.length, color: "var(--c-accent)" },
          { label: "Assigned", value: drivers.filter((d) => d.assignedDeviceId).length, color: "var(--c-success)" },
          { label: "Unassigned", value: drivers.filter((d) => !d.assignedDeviceId).length },
          { label: "License Expiring Soon", value: drivers.filter((d) => { const days = Math.ceil((new Date(d.licenseExpiry).getTime() - Date.now()) / 86400000); return days >= 0 && days <= 30; }).length, color: "var(--c-warning)" },
        ].map((c) => (
          <div key={c.label} className="col-6 col-md-3">
            <StatCard label={c.label} value={c.value} color={(c as any).color} />
          </div>
        ))}
      </div>

      {/* Driver table */}
      <div className="card">
        <div className="card-header">
          <strong>Registered Drivers ({drivers.length})</strong>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive table-responsive-mobile">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>License #</th>
                  <th>Expiry</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Assigned Vehicle</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      <div className="spinner-border spinner-border-sm me-2" />
                      Loading…
                    </td>
                  </tr>
                ) : pagedDrivers.length === 0 ? (
                  <tr><td colSpan={7}>
                    <EmptyState
                      icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                      title="No drivers yet"
                      message="Add your first driver to start managing your fleet."
                      action={{ label: "+ Add Driver", onClick: handleOpenAdd }}
                    />
                  </td></tr>
                ) : pagedDrivers.map((driver) => {
                  const vehicleName = getDeviceName(driver.assignedDeviceId);
                  return (
                    <tr key={driver.id}>
                      <td className="fw-semibold">{driver.name}</td>
                      <td>
                        <code>{driver.licenseNumber}</code>
                      </td>
                      <td>
                        <LicenseBadge expiry={driver.licenseExpiry} />
                      </td>
                      <td>{driver.phone}</td>
                      <td>
                        <small>{driver.email}</small>
                      </td>
                      <td>
                        {vehicleName ? (
                          <span className="badge bg-primary">{vehicleName}</span>
                        ) : (
                          <span className="badge bg-secondary">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => handleOpenEdit(driver)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(driver)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <>
          <div className="modal fade show" style={{ display: "block" }} tabIndex={-1}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <form onSubmit={handleSubmit} noValidate>
                  <div className="modal-header">
                    <h5 className="modal-title">
                      {editingDriver ? "Edit Driver" : "Add Driver"}
                    </h5>
                    <button type="button" className="btn-close" onClick={handleClose} />
                  </div>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Full Name *</label>
                        <input
                          name="name"
                          className={`form-control ${errors.name ? "is-invalid" : ""}`}
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="e.g. John Smith"
                        />
                        {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">License Number *</label>
                        <input
                          name="licenseNumber"
                          className={`form-control ${errors.licenseNumber ? "is-invalid" : ""}`}
                          value={formData.licenseNumber}
                          onChange={handleChange}
                          placeholder="e.g. DL-1234567"
                        />
                        {errors.licenseNumber && (
                          <div className="invalid-feedback">{errors.licenseNumber}</div>
                        )}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">License Expiry *</label>
                        <input
                          type="date"
                          name="licenseExpiry"
                          className={`form-control ${errors.licenseExpiry ? "is-invalid" : ""}`}
                          value={formData.licenseExpiry}
                          onChange={handleChange}
                        />
                        {errors.licenseExpiry && (
                          <div className="invalid-feedback">{errors.licenseExpiry}</div>
                        )}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Phone *</label>
                        <input
                          type="tel"
                          name="phone"
                          className={`form-control ${errors.phone ? "is-invalid" : ""}`}
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="+1 555 000 0000"
                        />
                        {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Email *</label>
                        <input
                          type="email"
                          name="email"
                          className={`form-control ${errors.email ? "is-invalid" : ""}`}
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="driver@example.com"
                        />
                        {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Assigned Vehicle</label>
                        <select
                          name="assignedDeviceId"
                          className="form-select"
                          value={formData.assignedDeviceId}
                          onChange={handleChange}
                        >
                          <option value="">-- Unassigned --</option>
                          {devices.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Notes</label>
                        <textarea
                          name="notes"
                          className="form-control"
                          rows={2}
                          value={formData.notes}
                          onChange={handleChange}
                          placeholder="Optional notes about this driver"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleClose}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? (
                        <span className="spinner-border spinner-border-sm me-1" />
                      ) : null}
                      {editingDriver ? "Save Changes" : "Add Driver"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </div>
  );
};

export default DriverManager;
