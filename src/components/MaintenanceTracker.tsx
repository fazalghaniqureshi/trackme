import { useState, useEffect } from "react";
import type { MaintenanceRecord, MaintenanceFormData } from "../types/maintenance";
import { SERVICE_TYPES } from "../types/maintenance";
import type { Device } from "../types/device";
import {
  getAllMaintenanceRecords,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
  getOverdueRecords,
  getUpcomingRecords,
} from "../services/maintenanceService";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import StatCard from './StatCard';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
import { formatCurrency } from '../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: MaintenanceFormData = {
  deviceId: "",
  serviceType: "Oil Change",
  serviceDate: today(),
  odometer: "",
  cost: "",
  notes: "",
  nextDueDate: "",
  nextDueOdometer: "",
};

const daysUntil = (dateStr: string) =>
  Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);

const NextDueBadge = ({ date }: { date: string | null }) => {
  if (!date) return <span className="text-muted">—</span>;
  const days = daysUntil(date);
  if (days < 0) return <span className="badge bg-danger">Overdue ({date})</span>;
  if (days <= 30)
    return (
      <span className="badge bg-warning text-dark">
        {date} ({days}d)
      </span>
    );
  return <span className="badge bg-info text-dark">{date}</span>;
};

const MaintenanceTracker = () => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [filterDevice, setFilterDevice] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [formData, setFormData] = useState<MaintenanceFormData>(EMPTY_FORM);
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
      setRecords(getAllMaintenanceRecords());
      setDevices(await getAllDevicesWithTraccar());
    } finally {
      setLoading(false);
    }
  };

  const getDeviceName = (deviceId: string) =>
    devices.find((d) => d.id === deviceId)?.name ?? "Unknown Vehicle";

  const overdue = getOverdueRecords();
  const upcoming = getUpcomingRecords(30);

  const filteredRecords = records
    .filter((r) => filterDevice === "all" || r.deviceId === filterDevice)
    .filter((r) => filterType === "all" || r.serviceType === filterType)
    .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

  const { page, totalPages, paged: pagedRecords, setPage } = usePagination(filteredRecords);

  const totalCost = filteredRecords.reduce((s, r) => s + r.cost, 0);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.deviceId) e.deviceId = "Vehicle is required.";
    if (!formData.serviceDate) e.serviceDate = "Service date is required.";
    if (!formData.odometer || parseFloat(formData.odometer) < 0)
      e.odometer = "Valid odometer reading is required.";
    if (!formData.cost || parseFloat(formData.cost) < 0)
      e.cost = "Valid cost is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setFormData({ ...EMPTY_FORM, serviceDate: today() });
    setErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setFormData({
      deviceId: record.deviceId,
      serviceType: record.serviceType,
      serviceDate: record.serviceDate,
      odometer: String(record.odometer),
      cost: String(record.cost),
      notes: record.notes,
      nextDueDate: record.nextDueDate ?? "",
      nextDueOdometer: record.nextDueOdometer != null ? String(record.nextDueOdometer) : "",
    });
    setErrors({});
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingRecord(null);
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
    const label = `${formData.serviceType} — ${getDeviceName(formData.deviceId)}`;
    if (editingRecord) {
      updateMaintenanceRecord(editingRecord.id, formData);
      setToast({ type: "success", text: `"${label}" updated.` });
    } else {
      createMaintenanceRecord(formData);
      setToast({ type: "success", text: `"${label}" logged.` });
    }
    setSaving(false);
    handleClose();
    setRecords(getAllMaintenanceRecords());
  };

  const handleDelete = (record: MaintenanceRecord) => {
    const label = `${record.serviceType} — ${getDeviceName(record.deviceId)}`;
    if (!window.confirm(`Delete "${label}"?`)) return;
    deleteMaintenanceRecord(record.id);
    setRecords(getAllMaintenanceRecords());
    setToast({ type: "success", text: `Record deleted.` });
  };

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Maintenance Tracker</h1>
        <button className="btn btn-success" onClick={handleOpenAdd}>
          + Log Service
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`alert alert-${toast.type} alert-dismissible`} role="alert">
          {toast.text}
          <button type="button" className="btn-close" onClick={() => setToast(null)} />
        </div>
      )}

      {/* Alert banners */}
      {overdue.length > 0 && (
        <div className="alert alert-danger mb-3">
          <strong>⚠ {overdue.length} service(s) overdue:</strong>{" "}
          {overdue.map((r) => `${getDeviceName(r.deviceId)} — ${r.serviceType}`).join(", ")}
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="alert alert-warning mb-3">
          <strong>{upcoming.length} service(s) due within 30 days:</strong>{" "}
          {upcoming.map((r) => `${getDeviceName(r.deviceId)} — ${r.serviceType}`).join(", ")}
        </div>
      )}

      {/* KPI cards */}
      <div className="row g-3 mb-4">
        {[
          { label: "Total Records", value: records.length, color: "var(--c-accent)" },
          { label: "Overdue", value: overdue.length, color: "var(--c-danger)" },
          { label: "Due This Month", value: upcoming.length, color: "var(--c-warning)" },
          { label: "Total Cost", value: formatCurrency(records.reduce((s, r) => s + (r.cost ?? 0), 0)) },
        ].map((c) => (
          <div key={c.label} className="col-6 col-md-3">
            <StatCard label={c.label} value={c.value} color={(c as any).color} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label fw-semibold">Vehicle</label>
              <select
                className="form-select"
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
              >
                <option value="all">All Vehicles</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold">Service Type</label>
              <select
                className="form-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4 text-end">
              <div className="text-muted small mb-1">Showing {filteredRecords.length} record(s)</div>
              <strong>Total Cost: {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <strong>Service Records ({filteredRecords.length})</strong>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive table-responsive-mobile">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Vehicle</th>
                  <th>Service Type</th>
                  <th>Date</th>
                  <th>Odometer (km)</th>
                  <th>Cost</th>
                  <th>Next Due</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-muted">
                      <div className="spinner-border spinner-border-sm me-2" />
                      Loading…
                    </td>
                  </tr>
                ) : pagedRecords.length === 0 ? (
                  <tr><td colSpan={8}>
                    <EmptyState
                      icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
                      title="No service records yet"
                      message="Log your first service to start tracking maintenance costs."
                      action={{ label: "+ Log Service", onClick: handleOpenAdd }}
                    />
                  </td></tr>
                ) : pagedRecords.map((r) => (
                  <tr key={r.id}>
                    <td className="fw-semibold">{getDeviceName(r.deviceId)}</td>
                    <td>
                      <span className="badge bg-secondary">{r.serviceType}</span>
                    </td>
                    <td>{r.serviceDate}</td>
                    <td>{r.odometer.toLocaleString()} km</td>
                    <td>{formatCurrency(r.cost ?? 0)}</td>
                    <td>
                      <NextDueBadge date={r.nextDueDate} />
                      {r.nextDueOdometer != null && (
                        <div>
                          <small className="text-muted">
                            or {r.nextDueOdometer.toLocaleString()} km
                          </small>
                        </div>
                      )}
                    </td>
                    <td>
                      <small className="text-muted">{r.notes || "—"}</small>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-primary me-1"
                        onClick={() => handleOpenEdit(r)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(r)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
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
                      {editingRecord ? "Edit Service Record" : "Log Service Record"}
                    </h5>
                    <button type="button" className="btn-close" onClick={handleClose} />
                  </div>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Vehicle *</label>
                        <select
                          name="deviceId"
                          className={`form-select ${errors.deviceId ? "is-invalid" : ""}`}
                          value={formData.deviceId}
                          onChange={handleChange}
                        >
                          <option value="">-- Select Vehicle --</option>
                          {devices.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        {errors.deviceId && (
                          <div className="invalid-feedback">{errors.deviceId}</div>
                        )}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Service Type *</label>
                        <select
                          name="serviceType"
                          className="form-select"
                          value={formData.serviceType}
                          onChange={handleChange}
                        >
                          {SERVICE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Service Date *</label>
                        <input
                          type="date"
                          name="serviceDate"
                          className={`form-control ${errors.serviceDate ? "is-invalid" : ""}`}
                          value={formData.serviceDate}
                          onChange={handleChange}
                        />
                        {errors.serviceDate && (
                          <div className="invalid-feedback">{errors.serviceDate}</div>
                        )}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Odometer (km) *</label>
                        <input
                          type="number"
                          name="odometer"
                          className={`form-control ${errors.odometer ? "is-invalid" : ""}`}
                          min={0}
                          value={formData.odometer}
                          onChange={handleChange}
                          placeholder="e.g. 45000"
                        />
                        {errors.odometer && (
                          <div className="invalid-feedback">{errors.odometer}</div>
                        )}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Cost *</label>
                        <input
                          type="number"
                          name="cost"
                          className={`form-control ${errors.cost ? "is-invalid" : ""}`}
                          min={0}
                          step={0.01}
                          value={formData.cost}
                          onChange={handleChange}
                          placeholder="0.00"
                        />
                        {errors.cost && (
                          <div className="invalid-feedback">{errors.cost}</div>
                        )}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Next Due Date</label>
                        <input
                          type="date"
                          name="nextDueDate"
                          className="form-control"
                          value={formData.nextDueDate}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Next Due Odometer (km)</label>
                        <input
                          type="number"
                          name="nextDueOdometer"
                          className="form-control"
                          min={0}
                          value={formData.nextDueOdometer}
                          onChange={handleChange}
                          placeholder="e.g. 50000"
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Notes</label>
                        <textarea
                          name="notes"
                          className="form-control"
                          rows={2}
                          value={formData.notes}
                          onChange={handleChange}
                          placeholder="Parts replaced, service centre, etc."
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
                      {editingRecord ? "Save Changes" : "Log Service"}
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

export default MaintenanceTracker;
