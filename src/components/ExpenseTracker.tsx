import { useState, useEffect } from "react";
import type { ExpenseEntry, ExpenseFormData, ExpenseCategory } from "../types/expense";
import { EXPENSE_CATEGORIES } from "../types/expense";
import type { Device } from "../types/device";
import {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getFleetExpenseStats,
} from "../services/expenseService";
import { getAllDevicesWithTraccar } from "../services/deviceService";

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: ExpenseFormData = {
  deviceId: "",
  category: "Other",
  date: today(),
  amount: "",
  description: "",
  notes: "",
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Toll: "primary",
  Parking: "secondary",
  Fine: "danger",
  Repair: "warning",
  Insurance: "info",
  Registration: "success",
  "Car Wash": "light",
  Other: "dark",
};

const ExpenseTracker = () => {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [filterDevice, setFilterDevice] = useState("all");
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadAll = async () => {
    setLoading(true);
    try {
      setEntries(getAllExpenses());
      setDevices(await getAllDevicesWithTraccar());
    } finally {
      setLoading(false);
    }
  };

  const getDeviceName = (deviceId: string) =>
    devices.find((d) => d.id === deviceId)?.name ?? "Unknown Vehicle";

  const stats = getFleetExpenseStats();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthTotal = entries
    .filter((e) => e.date.startsWith(thisMonth))
    .reduce((s, e) => s + e.amount, 0);

  const filteredEntries = entries
    .filter((e) => filterDevice === "all" || e.deviceId === filterDevice)
    .filter((e) => filterCategory === "all" || e.category === filterCategory)
    .filter((e) => !filterFrom || e.date >= filterFrom)
    .filter((e) => !filterTo || e.date <= filterTo)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredTotal = filteredEntries.reduce((s, e) => s + e.amount, 0);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.deviceId) e.deviceId = "Vehicle is required.";
    if (!formData.date) e.date = "Date is required.";
    if (!formData.amount || parseFloat(formData.amount) <= 0)
      e.amount = "Amount must be greater than 0.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleOpenAdd = () => {
    setEditingEntry(null);
    setFormData({ ...EMPTY_FORM, date: today() });
    setErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (entry: ExpenseEntry) => {
    setEditingEntry(entry);
    setFormData({
      deviceId: entry.deviceId,
      category: entry.category,
      date: entry.date,
      amount: String(entry.amount),
      description: entry.description,
      notes: entry.notes,
    });
    setErrors({});
    setShowModal(true);
  };

  const handleClose = () => { setShowModal(false); setEditingEntry(null); };

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
      updateExpense(editingEntry.id, formData);
      setToast({ type: "success", text: "Expense updated." });
    } else {
      createExpense(formData);
      setToast({ type: "success", text: "Expense logged." });
    }
    setSaving(false);
    handleClose();
    setEntries(getAllExpenses());
  };

  const handleDelete = (entry: ExpenseEntry) => {
    if (!window.confirm(`Delete ${entry.category} expense of ${entry.amount} for ${getDeviceName(entry.deviceId)}?`)) return;
    deleteExpense(entry.id);
    setEntries(getAllExpenses());
    setToast({ type: "success", text: "Expense deleted." });
  };

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Expense Tracker</h1>
        <button className="btn btn-success" onClick={handleOpenAdd}>+ Add Expense</button>
      </div>

      {toast && (
        <div className={`alert alert-${toast.type} alert-dismissible`} role="alert">
          {toast.text}
          <button type="button" className="btn-close" onClick={() => setToast(null)} />
        </div>
      )}

      {/* KPI cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card text-white bg-primary h-100">
            <div className="card-body py-3">
              <div className="small opacity-75">Total Expenses</div>
              <div className="fs-4 fw-bold">{fmt(stats.totalExpenses)}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card text-white bg-secondary h-100">
            <div className="card-body py-3">
              <div className="small opacity-75">Total Records</div>
              <div className="fs-4 fw-bold">{stats.totalCount}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card text-white bg-warning h-100">
            <div className="card-body py-3">
              <div className="small opacity-75">Top Category</div>
              <div className="fs-4 fw-bold">{stats.mostExpensiveCategory ?? "—"}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card text-white bg-info h-100">
            <div className="card-body py-3">
              <div className="small opacity-75">This Month</div>
              <div className="fs-4 fw-bold">{fmt(thisMonthTotal)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-semibold">Vehicle</label>
              <select className="form-select" value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)}>
                <option value="all">All Vehicles</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">Category</label>
              <select
                className="form-select"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | "all")}
              >
                <option value="all">All Categories</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-semibold">From</label>
              <input type="date" className="form-control" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-semibold">To</label>
              <input type="date" className="form-control" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
            <div className="col-md-2">
              <button className="btn btn-outline-secondary w-100" onClick={() => { setFilterDevice("all"); setFilterCategory("all"); setFilterFrom(""); setFilterTo(""); }}>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Expense Records ({filteredEntries.length})</strong>
          {filteredEntries.length > 0 && (
            <small className="text-muted">Total: <strong>{fmt(filteredTotal)}</strong></small>
          )}
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Vehicle</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      <div className="spinner-border spinner-border-sm me-2" />Loading…
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No expenses yet. Click "+ Add Expense" to get started.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="fw-semibold">{getDeviceName(entry.deviceId)}</td>
                      <td>
                        <span className={`badge bg-${CATEGORY_COLORS[entry.category]}`}>
                          {entry.category}
                        </span>
                      </td>
                      <td>{entry.date}</td>
                      <td className="fw-semibold">{fmt(entry.amount)}</td>
                      <td>{entry.description || <span className="text-muted">—</span>}</td>
                      <td><small className="text-muted">{entry.notes || "—"}</small></td>
                      <td>
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => handleOpenEdit(entry)}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(entry)}>Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                    <h5 className="modal-title">{editingEntry ? "Edit Expense" : "Add Expense"}</h5>
                    <button type="button" className="btn-close" onClick={handleClose} />
                  </div>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Vehicle *</label>
                        <select name="deviceId" className={`form-select ${errors.deviceId ? "is-invalid" : ""}`} value={formData.deviceId} onChange={handleChange}>
                          <option value="">-- Select Vehicle --</option>
                          {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        {errors.deviceId && <div className="invalid-feedback">{errors.deviceId}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Category *</label>
                        <select name="category" className="form-select" value={formData.category} onChange={handleChange}>
                          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Date *</label>
                        <input type="date" name="date" className={`form-control ${errors.date ? "is-invalid" : ""}`} value={formData.date} onChange={handleChange} />
                        {errors.date && <div className="invalid-feedback">{errors.date}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Amount *</label>
                        <input type="number" name="amount" className={`form-control ${errors.amount ? "is-invalid" : ""}`} min={0} step={0.01} value={formData.amount} onChange={handleChange} placeholder="0.00" />
                        {errors.amount && <div className="invalid-feedback">{errors.amount}</div>}
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Description</label>
                        <input type="text" name="description" className="form-control" value={formData.description} onChange={handleChange} placeholder="Brief description of the expense" />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Notes</label>
                        <textarea name="notes" className="form-control" rows={2} value={formData.notes} onChange={handleChange} placeholder="Additional details, receipt reference, etc." />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                      {editingEntry ? "Save Changes" : "Add Expense"}
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

export default ExpenseTracker;
