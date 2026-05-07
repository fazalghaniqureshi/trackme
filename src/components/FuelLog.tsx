import { useState, useEffect } from "react";
import type { FuelEntry, FuelFormData } from "../types/fuel";
import type { Device } from "../types/device";
import {
  getAllFuelEntries,
  createFuelEntry,
  updateFuelEntry,
  deleteFuelEntry,
  getFleetFuelStats,
} from "../services/fuelService";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import StatCard from './StatCard';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
import { formatCurrency } from '../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: FuelFormData = {
  deviceId: "",
  date: today(),
  liters: "",
  costPerLiter: "",
  odometer: "",
  notes: "",
};

const FuelLog = () => {
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [filterDevice, setFilterDevice] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FuelEntry | null>(null);
  const [formData, setFormData] = useState<FuelFormData>(EMPTY_FORM);
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
      setEntries(getAllFuelEntries());
      setDevices(await getAllDevicesWithTraccar());
    } finally {
      setLoading(false);
    }
  };

  const getDeviceName = (deviceId: string) =>
    devices.find((d) => d.id === deviceId)?.name ?? "Unknown Vehicle";

  const stats = getFleetFuelStats();

  const filteredEntries = entries
    .filter((e) => filterDevice === "all" || e.deviceId === filterDevice)
    .filter((e) => !filterFrom || e.date >= filterFrom)
    .filter((e) => !filterTo || e.date <= filterTo)
    .sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return diff !== 0 ? diff : b.odometer - a.odometer;
    });

  const { page, totalPages, paged: pagedEntries, setPage } = usePagination(filteredEntries);
  useEffect(() => { setPage(1); }, [filterDevice, filterFrom, filterTo]);

  const filteredTotalLiters = filteredEntries.reduce((s, e) => s + e.liters, 0);
  const filteredTotalCost = filteredEntries.reduce((s, e) => s + e.totalCost, 0);
  const filteredEfficiencies = filteredEntries
    .map((e) => e.fuelEfficiency)
    .filter((e): e is number => e !== null);
  const filteredAvgEfficiency =
    filteredEfficiencies.length > 0
      ? (filteredEfficiencies.reduce((s, e) => s + e, 0) / filteredEfficiencies.length).toFixed(2)
      : null;

  // Live preview in modal
  const previewCost =
    parseFloat(formData.liters) > 0 && parseFloat(formData.costPerLiter) > 0
      ? (parseFloat(formData.liters) * parseFloat(formData.costPerLiter)).toFixed(2)
      : null;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.deviceId) e.deviceId = "Vehicle is required.";
    if (!formData.date) e.date = "Date is required.";
    if (!formData.liters || parseFloat(formData.liters) <= 0)
      e.liters = "Liters must be greater than 0.";
    if (!formData.costPerLiter || parseFloat(formData.costPerLiter) <= 0)
      e.costPerLiter = "Cost per liter must be greater than 0.";
    if (formData.odometer === "" || parseFloat(formData.odometer) < 0)
      e.odometer = "Valid odometer reading is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleOpenAdd = () => {
    setEditingEntry(null);
    setFormData({ ...EMPTY_FORM, date: today() });
    setErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (entry: FuelEntry) => {
    setEditingEntry(entry);
    setFormData({
      deviceId: entry.deviceId,
      date: entry.date,
      liters: String(entry.liters),
      costPerLiter: String(entry.costPerLiter),
      odometer: String(entry.odometer),
      notes: entry.notes,
    });
    setErrors({});
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingEntry(null);
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
    if (editingEntry) {
      updateFuelEntry(editingEntry.id, formData);
      setToast({ type: "success", text: "Fill-up entry updated." });
    } else {
      createFuelEntry(formData);
      setToast({ type: "success", text: "Fill-up logged." });
    }
    setSaving(false);
    handleClose();
    setEntries(getAllFuelEntries());
  };

  const handleDelete = (entry: FuelEntry) => {
    if (!window.confirm(`Delete fill-up for ${getDeviceName(entry.deviceId)} on ${entry.date}?`))
      return;
    deleteFuelEntry(entry.id);
    setEntries(getAllFuelEntries());
    setToast({ type: "success", text: "Entry deleted." });
  };

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Fuel Log</h1>
        <button className="btn btn-success" onClick={handleOpenAdd}>
          + Log Fill-Up
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
        {(
          [
            { label: "Total Fill-Ups", value: stats.totalFillUps, color: "var(--c-accent)" },
            { label: "Total Fuel", value: stats.totalLiters.toFixed(1), unit: "L" },
            { label: "Total Fuel Cost", value: formatCurrency(stats.totalCost) },
            { label: "Avg Efficiency", value: stats.avgEfficiency != null ? stats.avgEfficiency.toFixed(2) : "—", unit: stats.avgEfficiency != null ? "km/L" : "", color: "var(--c-success)" },
          ] as { label: string; value: string | number; color?: string; unit?: string }[]
        ).map((c) => (
          <div key={c.label} className="col-6 col-md-3">
            <StatCard label={c.label} value={c.value} color={c.color} unit={c.unit} />
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
            <div className="col-md-3">
              <label className="form-label fw-semibold">From</label>
              <input
                type="date"
                className="form-control"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">To</label>
              <input
                type="date"
                className="form-control"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setFilterDevice("all");
                  setFilterFrom("");
                  setFilterTo("");
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Fill-Up Records ({filteredEntries.length})</strong>
          {filteredEntries.length > 0 && (
            <small className="text-muted">
              {filteredTotalLiters.toFixed(1)} L &middot;{" "}
              {filteredTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
              {filteredAvgEfficiency && ` · avg ${filteredAvgEfficiency} km/L`}
            </small>
          )}
        </div>
        <div className="card-body p-0">
          <div className="table-responsive table-responsive-mobile">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Vehicle</th>
                  <th>Date</th>
                  <th>Liters</th>
                  <th>Cost/L</th>
                  <th>Total Cost</th>
                  <th>Odometer (km)</th>
                  <th>Efficiency</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-muted">
                      <div className="spinner-border spinner-border-sm me-2" />
                      Loading…
                    </td>
                  </tr>
                ) : pagedEntries.length === 0 ? (
                  <tr><td colSpan={9}>
                    <EmptyState
                      icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 22V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15"/><path d="M2 22h14"/><path d="M15 7h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9a7 7 0 0 0-7-7H15"/><line x1="6" y1="11" x2="12" y2="11"/></svg>}
                      title="No fuel records yet"
                      message="Log your first fill-up to start tracking fuel costs and efficiency."
                      action={{ label: "+ Log Fill-Up", onClick: handleOpenAdd }}
                    />
                  </td></tr>
                ) : pagedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="fw-semibold">{getDeviceName(entry.deviceId)}</td>
                    <td>{entry.date}</td>
                    <td>{entry.liters.toFixed(1)} L</td>
                    <td>{formatCurrency(entry.costPerLiter)}</td>
                    <td className="fw-semibold">{formatCurrency(entry.totalCost)}</td>
                    <td>{entry.odometer.toLocaleString()} km</td>
                    <td>
                      {entry.fuelEfficiency != null ? (
                        <span className="badge bg-info text-dark">
                          {entry.fuelEfficiency} km/L
                        </span>
                      ) : (
                        <span className="badge bg-secondary">—</span>
                      )}
                    </td>
                    <td>
                      <small className="text-muted">{entry.notes || "—"}</small>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-primary me-1"
                        onClick={() => handleOpenEdit(entry)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(entry)}
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
                      {editingEntry ? "Edit Fill-Up" : "Log Fill-Up"}
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
                        <label className="form-label fw-semibold">Date *</label>
                        <input
                          type="date"
                          name="date"
                          className={`form-control ${errors.date ? "is-invalid" : ""}`}
                          value={formData.date}
                          onChange={handleChange}
                        />
                        {errors.date && <div className="invalid-feedback">{errors.date}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Liters *</label>
                        <input
                          type="number"
                          name="liters"
                          className={`form-control ${errors.liters ? "is-invalid" : ""}`}
                          min={0.1}
                          step={0.1}
                          value={formData.liters}
                          onChange={handleChange}
                          placeholder="e.g. 45.5"
                        />
                        {errors.liters && (
                          <div className="invalid-feedback">{errors.liters}</div>
                        )}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Cost per Liter *</label>
                        <input
                          type="number"
                          name="costPerLiter"
                          className={`form-control ${errors.costPerLiter ? "is-invalid" : ""}`}
                          min={0}
                          step={0.01}
                          value={formData.costPerLiter}
                          onChange={handleChange}
                          placeholder="e.g. 1.85"
                        />
                        {errors.costPerLiter && (
                          <div className="invalid-feedback">{errors.costPerLiter}</div>
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
                        <label className="form-label fw-semibold">Summary</label>
                        <div className="p-2 bg-light rounded" style={{ minHeight: 38 }}>
                          {previewCost ? (
                            <>
                              <small>
                                Total Cost:{" "}
                                <strong>{previewCost}</strong>
                              </small>
                              <br />
                              <small className="text-muted">
                                Efficiency calculated automatically from previous fill-up
                              </small>
                            </>
                          ) : (
                            <small className="text-muted">
                              Enter liters and cost to see total
                            </small>
                          )}
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Notes</label>
                        <textarea
                          name="notes"
                          className="form-control"
                          rows={2}
                          value={formData.notes}
                          onChange={handleChange}
                          placeholder="Station name, fuel type, etc."
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
                      {editingEntry ? "Save Changes" : "Log Fill-Up"}
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

export default FuelLog;
