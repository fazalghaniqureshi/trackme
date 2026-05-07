import { useState, useEffect } from "react";
import type { Device, DeviceFormData, TeltonikaModel } from "../types/device";
import {
  getAllDevicesWithTraccar,
  createDevice,
  updateDevice,
  deleteDevice,
  validateIMEI,
} from "../services/deviceService";
import {
  isTraccarConfigured,
  createTraccarDevice,
  updateTraccarDevice,
  deleteTraccarDevice,
} from "../services/traccarService";
import { useNavigate } from "react-router-dom";

const AdminPanel = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [formData, setFormData] = useState<DeviceFormData>({
    name: "",
    imei: "",
    model: "FMB120",
    description: "",
    initialLat: 33.5816,
    initialLon: 71.4492,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "danger"; text: string } | null>(null);
  const navigate = useNavigate();

  const traccarConnected = isTraccarConfigured();

  useEffect(() => {
    loadDevices();
  }, []);

  // Auto-dismiss toast after 4 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadDevices = async () => {
    setLoading(true);
    try {
      setDevices(await getAllDevicesWithTraccar());
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "initialLat" || name === "initialLon"
          ? parseFloat(value) || 0
          : name === "model"
          ? (value as TeltonikaModel)
          : value,
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Device name is required";
    if (!formData.imei.trim()) {
      newErrors.imei = "IMEI is required";
    } else if (!validateIMEI(formData.imei)) {
      newErrors.imei = "IMEI must be 15 or 16 digits";
    } else {
      const duplicate = devices.find(
        (d) => d.imei === formData.imei && d.id !== editingDevice?.id
      );
      if (duplicate) newErrors.imei = "A device with this IMEI already exists";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (editingDevice) {
        // ── Update ──────────────────────────────────────────────────────────
        const updates: Partial<Device> = {
          name: formData.name,
          imei: formData.imei,
          model: formData.model,
          description: formData.description,
          coords:
            formData.initialLat && formData.initialLon
              ? [formData.initialLat, formData.initialLon]
              : editingDevice.coords,
          prevCoords:
            formData.initialLat && formData.initialLon
              ? [formData.initialLat, formData.initialLon]
              : editingDevice.prevCoords,
        };

        // Sync to Traccar if connected
        if (traccarConnected && editingDevice.traccarId) {
          const ok = await updateTraccarDevice(
            editingDevice.traccarId,
            formData.name,
            formData.imei
          );
          if (!ok) {
            setToast({ type: "danger", text: "Traccar update failed — local changes saved." });
          } else {
            setToast({ type: "success", text: `"${formData.name}" updated in Traccar.` });
          }
        } else {
          setToast({ type: "success", text: "Device updated locally." });
        }

        updateDevice(editingDevice.id, updates);
      } else {
        // ── Create ──────────────────────────────────────────────────────────
        let traccarId: number | undefined;

        if (traccarConnected) {
          const traccarDevice = await createTraccarDevice(formData.name, formData.imei);
          if (traccarDevice) {
            traccarId = traccarDevice.id;
            setToast({ type: "success", text: `"${formData.name}" added to Traccar (ID ${traccarId}).` });
          } else {
            setToast({ type: "danger", text: "Failed to add device to Traccar. Check your connection." });
          }
        } else {
          // Traccar not connected — save locally as fallback
          const newDevice = createDevice(formData);
          if (traccarId !== undefined) updateDevice(newDevice.id, { traccarId });
          setToast({ type: "success", text: "Device saved locally. Connect Traccar to sync." });
        }
      }
    } finally {
      setSaving(false);
      resetForm();
      loadDevices();
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      imei: "",
      model: "FMB120",
      description: "",
      initialLat: 33.5816,
      initialLon: 71.4492,
    });
    setEditingDevice(null);
    setShowForm(false);
    setErrors({});
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      imei: device.imei,
      model: device.model,
      description: device.description || "",
      initialLat: device.coords[0],
      initialLon: device.coords[1],
    });
    setShowForm(true);
  };

  const handleDelete = async (device: Device) => {
    if (!window.confirm(`Delete "${device.name}"? This cannot be undone.`)) return;

    setSaving(true);
    try {
      if (traccarConnected && device.traccarId) {
        const ok = await deleteTraccarDevice(device.traccarId);
        if (!ok) {
          setToast({ type: "danger", text: "Traccar delete failed — removed locally only." });
        }
      }
      deleteDevice(device.id);
      if (editingDevice?.id === device.id) resetForm();
      loadDevices();
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: Device["status"]) => {
    const colors = { online: "success", offline: "danger", unknown: "secondary" };
    return <span className={`badge bg-${colors[status]}`}>{status.toUpperCase()}</span>;
  };

  return (
    <div className="container-fluid p-4">
      {/* Toast */}
      {toast && (
        <div
          className={`alert alert-${toast.type} alert-dismissible`}
          role="alert"
          style={{ position: "sticky", top: 12, zIndex: 1050 }}
        >
          {toast.text}
          <button type="button" className="btn-close" onClick={() => setToast(null)} />
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="mb-0">Device Management</h1>
          {traccarConnected ? (
            <small className="text-success">● Traccar connected — devices sync automatically</small>
          ) : (
            <small className="text-muted">
              Traccar not connected —{" "}
              <span
                className="text-primary"
                style={{ cursor: "pointer" }}
                onClick={() => navigate("/traccar")}
              >
                connect now
              </span>{" "}
              to sync devices
            </small>
          )}
        </div>
        <button
          className="btn btn-success"
          onClick={() => { resetForm(); setShowForm(true); }}
          disabled={saving}
        >
          + Add Device
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{editingDevice ? "Edit Device" : "Add New Device"}</h5>
            {traccarConnected && (
              <span className="badge bg-success">Will sync to Traccar</span>
            )}
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Device Name *</label>
                  <input
                    type="text"
                    className={`form-control ${errors.name ? "is-invalid" : ""}`}
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., My Car, Truck A"
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Device Model *</label>
                  <select
                    className="form-select"
                    name="model"
                    value={formData.model}
                    onChange={handleInputChange}
                  >
                    <optgroup label="FMB Series">
                      {["FMB001","FMB010","FMB100","FMB110","FMB120","FMB122","FMB125","FMB130","FMB140","FMB900","FMB920","FMB962","FMB964"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </optgroup>
                    <optgroup label="FMC Series">
                      {["FMC001","FMC110","FMC125","FMC130"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </optgroup>
                    <optgroup label="FMM Series">
                      {["FMM001","FMM640"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Other">
                      {["FMP100","FMT100","FMT250","GH3000","GH5200","Other"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">IMEI (15–16 digits) *</label>
                <input
                  type="text"
                  className={`form-control ${errors.imei ? "is-invalid" : ""}`}
                  name="imei"
                  value={formData.imei}
                  onChange={handleInputChange}
                  placeholder="123456789012345"
                  maxLength={16}
                />
                {errors.imei && <div className="invalid-feedback">{errors.imei}</div>}
                <small className="form-text text-muted">
                  Used as the unique identifier in Traccar
                </small>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Initial Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    name="initialLat"
                    value={formData.initialLat}
                    onChange={handleInputChange}
                    placeholder="33.5816"
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Initial Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    name="initialLon"
                    value={formData.initialLon}
                    onChange={handleInputChange}
                    placeholder="71.4492"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Optional notes"
                />
              </div>

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <><span className="spinner-border spinner-border-sm me-1" /> Saving...</>
                  ) : editingDevice ? "Update Device" : "Create Device"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Registered Devices ({devices.length})</h5>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border spinner-border-sm me-2" />
              Loading devices…
            </div>
          ) : devices.length === 0 ? (
            <p className="text-muted p-4">No devices registered. Click "+ Add Device" to get started.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>IMEI</th>
                    <th>Model</th>
                    <th>Traccar</th>
                    <th>Status</th>
                    <th>Speed</th>
                    <th>Battery</th>
                    <th>Last Update</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <strong>{device.name}</strong>
                        {device.description && (
                          <><br /><small className="text-muted">{device.description}</small></>
                        )}
                      </td>
                      <td><code>{device.imei}</code></td>
                      <td>{device.model}</td>
                      <td>
                        {device.traccarId ? (
                          <span className="badge bg-success">ID {device.traccarId}</span>
                        ) : (
                          <span className="badge bg-secondary">Local only</span>
                        )}
                      </td>
                      <td>{getStatusBadge(device.status)}</td>
                      <td>
                        {device.speed !== undefined ? `${device.speed.toFixed(0)} km/h` : "-"}
                      </td>
                      <td>
                        {device.battery !== undefined ? `${device.battery}%` : "-"}
                      </td>
                      <td>
                        <small>
                          {device.lastUpdate
                            ? new Date(device.lastUpdate).toLocaleString()
                            : "Never"}
                        </small>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => handleEdit(device)}
                          disabled={saving}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(device)}
                          disabled={saving}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
