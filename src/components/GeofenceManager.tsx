import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  getTraccarGeofences,
  createTraccarGeofence,
  deleteTraccarGeofence,
  getDeviceGeofenceIds,
  linkGeofenceToDevice,
  unlinkGeofenceFromDevice,
  isTraccarConfigured,
} from "../services/traccarService";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import type { TraccarGeofence } from "../types/geofence";
import type { Device } from "../types/device";

// ---------------------------------------------------------------------------
// WKT helpers
// ---------------------------------------------------------------------------

const parseCircleWKT = (
  area: string
): { lat: number; lng: number; radius: number } | null => {
  const m = area.match(/CIRCLE\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([\d.]+)\s*\)/i);
  if (!m) return null;
  return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), radius: parseFloat(m[3]) };
};

const buildCircleWKT = (lat: number, lng: number, radius: number) =>
  `CIRCLE (${lat.toFixed(6)} ${lng.toFixed(6)}, ${radius})`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ClickHandlerProps {
  active: boolean;
  onPick: (lat: number, lng: number) => void;
}

const ClickHandler = ({ active, onPick }: ClickHandlerProps) => {
  useMapEvents({
    click(e) {
      if (active) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const FlyTo = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FENCE_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const GeofenceManager = () => {
  const [geofences, setGeofences]       = useState<TraccarGeofence[]>([]);
  const [devices, setDevices]           = useState<Device[]>([]);
  // geofenceId → traccarId[] of linked devices
  const [assignments, setAssignments]   = useState<Record<number, number[]>>({});
  const [loading, setLoading]           = useState(true);
  const [deleting, setDeleting]         = useState<number | null>(null);
  const [saving, setSaving]             = useState(false);
  const [togglingKey, setTogglingKey]   = useState<string | null>(null); // "deviceId-geofenceId"
  const [expandedFence, setExpandedFence] = useState<number | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState<string | null>(null);
  const [vehicleCenter, setVehicleCenter] = useState<[number, number] | null>(null);

  // New-geofence form
  const [pickMode, setPickMode]         = useState(false);
  const [pickedCenter, setPickedCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [formName, setFormName]         = useState("");
  const [formRadius, setFormRadius]     = useState("500");
  const [formDesc, setFormDesc]         = useState("");
  const [formDeviceIds, setFormDeviceIds] = useState<number[]>([]); // traccarIds to assign on create

  const navigate = useNavigate();
  const mapRef   = useRef<L.Map | null>(null);

  // ── Load everything on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!isTraccarConfigured()) return;
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [geoData, deviceData] = await Promise.all([
      getTraccarGeofences(),
      getAllDevicesWithTraccar(),
    ]);
    setGeofences(geoData);
    setDevices(deviceData);

    // Pan map to first online vehicle
    const target =
      deviceData.find((d) => d.status === "online" && (d.coords[0] !== 0 || d.coords[1] !== 0)) ??
      deviceData.find((d) => d.coords[0] !== 0 || d.coords[1] !== 0);
    if (target) setVehicleCenter(target.coords);

    // Build assignment map: geofenceId → traccarId[]
    const withTraccar = deviceData.filter((d) => d.traccarId);
    const results = await Promise.all(
      withTraccar.map(async (d) => ({
        traccarId: d.traccarId!,
        geofenceIds: await getDeviceGeofenceIds(d.traccarId!),
      }))
    );
    const assignMap: Record<number, number[]> = {};
    for (const { traccarId, geofenceIds } of results) {
      for (const gfId of geofenceIds) {
        if (!assignMap[gfId]) assignMap[gfId] = [];
        assignMap[gfId].push(traccarId);
      }
    }
    setAssignments(assignMap);
    setLoading(false);
  };

  // ── Create geofence ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formName.trim())  { setError("Name is required."); return; }
    if (!pickedCenter)     { setError("Click on the map to set the geofence center."); return; }
    const radius = parseInt(formRadius, 10);
    if (!radius || radius < 50) { setError("Radius must be at least 50 m."); return; }

    setSaving(true);
    setError(null);
    const area   = buildCircleWKT(pickedCenter.lat, pickedCenter.lng, radius);
    const result = await createTraccarGeofence({
      name: formName.trim(),
      description: formDesc.trim() || undefined,
      area,
    });
    if (!result) {
      setSaving(false);
      setError("Failed to create geofence. Check Traccar connection.");
      return;
    }

    // Link selected devices
    if (formDeviceIds.length > 0) {
      await Promise.all(formDeviceIds.map((did) => linkGeofenceToDevice(did, result.id)));
      setAssignments((prev) => ({ ...prev, [result.id]: formDeviceIds }));
    }

    setSaving(false);
    setSuccess(`Geofence "${result.name}" created${formDeviceIds.length ? ` and linked to ${formDeviceIds.length} vehicle(s)` : ""}.`);
    setFormName(""); setFormDesc(""); setFormRadius("500");
    setPickedCenter(null); setFormDeviceIds([]);
    setTimeout(() => setSuccess(null), 5000);
    setGeofences((prev) => [...prev, result]);
  };

  // ── Delete geofence ──────────────────────────────────────────────────────
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete geofence "${name}"?`)) return;
    setDeleting(id);
    const ok = await deleteTraccarGeofence(id);
    setDeleting(null);
    if (ok) {
      setGeofences((prev) => prev.filter((g) => g.id !== id));
      setAssignments((prev) => { const next = { ...prev }; delete next[id]; return next; });
      if (expandedFence === id) setExpandedFence(null);
      setSuccess(`Geofence "${name}" deleted.`);
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setError("Failed to delete geofence.");
    }
  };

  // ── Toggle device ↔ geofence assignment ──────────────────────────────────
  const toggleAssignment = async (device: Device, geofenceId: number) => {
    if (!device.traccarId) return;
    const key    = `${device.traccarId}-${geofenceId}`;
    const linked = (assignments[geofenceId] ?? []).includes(device.traccarId);
    setTogglingKey(key);
    const ok = linked
      ? await unlinkGeofenceFromDevice(device.traccarId, geofenceId)
      : await linkGeofenceToDevice(device.traccarId, geofenceId);
    if (ok) {
      setAssignments((prev) => {
        const cur = prev[geofenceId] ?? [];
        return {
          ...prev,
          [geofenceId]: linked
            ? cur.filter((id) => id !== device.traccarId)
            : [...cur, device.traccarId!],
        };
      });
    } else {
      setError("Failed to update assignment.");
    }
    setTogglingKey(null);
  };

  // ── Toggle device in create-form selection ───────────────────────────────
  const toggleFormDevice = (traccarId: number) => {
    setFormDeviceIds((prev) =>
      prev.includes(traccarId) ? prev.filter((id) => id !== traccarId) : [...prev, traccarId]
    );
  };

  // ── Not configured ───────────────────────────────────────────────────────
  if (!isTraccarConfigured()) {
    return (
      <div className="container p-5 text-center">
        <h4 className="text-muted">Traccar not connected</h4>
        <p className="text-muted">Connect to Traccar to manage geofences.</p>
        <button className="btn btn-primary" onClick={() => navigate("/traccar")}>
          Connect to Traccar
        </button>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Geofences</h1>
        <span className="badge bg-info fs-6">{geofences.length} zone{geofences.length !== 1 ? "s" : ""}</span>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} />
        </div>
      )}
      {success && (
        <div className="alert alert-success alert-dismissible" role="alert">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess(null)} />
        </div>
      )}

      <div className="row g-4">
        {/* ── Map ─────────────────────────────────────────────────────── */}
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Map</strong>
              {pickMode ? (
                <span className="badge bg-warning text-dark">Click on map to place center</span>
              ) : pickedCenter ? (
                <span className="badge bg-success">
                  Center: {pickedCenter.lat.toFixed(5)}, {pickedCenter.lng.toFixed(5)}
                </span>
              ) : (
                <span className="text-muted small">Click "Pick on map" then tap a location</span>
              )}
            </div>
            <div className="card-body p-0" style={{ height: 520 }}>
              <MapContainer
                center={[0, 20]}
                zoom={3}
                style={{ height: "100%", width: "100%" }}
                ref={mapRef}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <ClickHandler active={pickMode} onPick={(lat, lng) => { setPickedCenter({ lat, lng }); setPickMode(false); }} />
                {vehicleCenter && <FlyTo center={vehicleCenter} zoom={13} />}

                {/* Existing geofences */}
                {geofences.map((g, i) => {
                  const parsed = parseCircleWKT(g.area);
                  if (!parsed) return null;
                  const color       = FENCE_COLORS[i % FENCE_COLORS.length];
                  const linkedCount = (assignments[g.id] ?? []).length;
                  return (
                    <Circle
                      key={g.id}
                      center={[parsed.lat, parsed.lng]}
                      radius={parsed.radius}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.15 }}
                    >
                      <Popup>
                        <strong>{g.name}</strong>
                        {g.description && <><br /><small>{g.description}</small></>}
                        <br />
                        <small className="text-muted">r = {parsed.radius.toLocaleString()} m</small>
                        <br />
                        <small className="text-muted">{linkedCount} vehicle{linkedCount !== 1 ? "s" : ""} assigned</small>
                      </Popup>
                    </Circle>
                  );
                })}

                {/* Pending center marker */}
                {pickedCenter && (
                  <Marker position={[pickedCenter.lat, pickedCenter.lng]}>
                    <Popup>New geofence center</Popup>
                  </Marker>
                )}

                {/* Preview circle */}
                {pickedCenter && parseInt(formRadius, 10) >= 50 && (
                  <Circle
                    center={[pickedCenter.lat, pickedCenter.lng]}
                    radius={parseInt(formRadius, 10)}
                    pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.1, dashArray: "6" }}
                  />
                )}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* ── Right panel ─────────────────────────────────────────────── */}
        <div className="col-lg-4 d-flex flex-column gap-3">

          {/* Create form */}
          <div className="card">
            <div className="card-header"><strong>Add Geofence</strong></div>
            <div className="card-body">
              <div className="mb-2">
                <label className="form-label fw-semibold">Name</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. Depot, Home, Customer Site"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="mb-2">
                <label className="form-label fw-semibold">Description (optional)</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Short note"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>
              <div className="mb-2">
                <label className="form-label fw-semibold">Radius (metres)</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  min={50}
                  max={50000}
                  value={formRadius}
                  onChange={(e) => setFormRadius(e.target.value)}
                />
              </div>

              {/* Center picker */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Center</label>
                <div className="mb-1">
                  {pickedCenter ? (
                    <span className="badge bg-success me-1">
                      {pickedCenter.lat.toFixed(5)}, {pickedCenter.lng.toFixed(5)}
                    </span>
                  ) : (
                    <span className="text-muted small">Not set</span>
                  )}
                </div>
                <button
                  className={`btn btn-sm w-100 ${pickMode ? "btn-warning" : "btn-outline-secondary"}`}
                  onClick={() => setPickMode((m) => !m)}
                >
                  {pickMode ? "Cancel picking" : "Pick on map"}
                </button>
              </div>

              {/* Assign vehicles */}
              {devices.filter((d) => d.traccarId).length > 0 && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Assign to vehicles
                    {formDeviceIds.length > 0 && (
                      <span className="badge bg-primary ms-2">{formDeviceIds.length}</span>
                    )}
                  </label>
                  <div
                    className="border rounded p-2"
                    style={{ maxHeight: 140, overflowY: "auto", background: "var(--bs-body-bg)" }}
                  >
                    {devices.filter((d) => d.traccarId).map((d) => (
                      <div key={d.id} className="form-check mb-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`fd-${d.id}`}
                          checked={formDeviceIds.includes(d.traccarId!)}
                          onChange={() => toggleFormDevice(d.traccarId!)}
                        />
                        <label className="form-check-label small" htmlFor={`fd-${d.id}`}>
                          <span
                            className={`badge me-1 ${d.status === "online" ? "bg-success" : "bg-secondary"}`}
                            style={{ fontSize: 9 }}
                          >
                            {d.status}
                          </span>
                          {d.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="d-flex gap-2 mt-1">
                    <button
                      className="btn btn-link btn-sm p-0 text-muted"
                      style={{ fontSize: 11 }}
                      onClick={() => setFormDeviceIds(devices.filter((d) => d.traccarId).map((d) => d.traccarId!))}
                    >
                      Select all
                    </button>
                    <button
                      className="btn btn-link btn-sm p-0 text-muted"
                      style={{ fontSize: 11 }}
                      onClick={() => setFormDeviceIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary w-100"
                onClick={handleCreate}
                disabled={saving || !formName.trim() || !pickedCenter}
              >
                {saving && <span className="spinner-border spinner-border-sm me-1" />}
                {saving ? "Saving…" : "Create Geofence"}
              </button>
            </div>
          </div>

          {/* Existing zones */}
          <div className="card flex-grow-1">
            <div className="card-header"><strong>Existing Zones</strong></div>
            <div className="card-body p-0" style={{ maxHeight: 480, overflowY: "auto" }}>
              {loading ? (
                <div className="text-center p-4 text-muted">
                  <div className="spinner-border spinner-border-sm me-2" />
                  Loading…
                </div>
              ) : geofences.length === 0 ? (
                <div className="text-center p-4 text-muted small">No geofences yet</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {geofences.map((g, i) => {
                    const parsed      = parseCircleWKT(g.area);
                    const color       = FENCE_COLORS[i % FENCE_COLORS.length];
                    const linked      = assignments[g.id] ?? [];
                    const isExpanded  = expandedFence === g.id;
                    return (
                      <li key={g.id} className="list-group-item p-0">
                        {/* Zone header row */}
                        <div className="d-flex align-items-center px-3 py-2 gap-2">
                          <span
                            style={{
                              width: 10, height: 10, borderRadius: "50%",
                              background: color, flexShrink: 0,
                            }}
                          />
                          <div className="flex-grow-1 min-w-0">
                            <div className="fw-semibold small text-truncate">{g.name}</div>
                            <div className="text-muted" style={{ fontSize: 11 }}>
                              {parsed ? `r = ${parsed.radius.toLocaleString()} m · ` : ""}
                              <span
                                className="text-primary"
                                style={{ cursor: "pointer" }}
                                onClick={() => setExpandedFence(isExpanded ? null : g.id)}
                              >
                                {linked.length} vehicle{linked.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                          <button
                            className="btn btn-sm btn-link p-0 text-muted me-1"
                            title="Manage vehicle assignments"
                            onClick={() => setExpandedFence(isExpanded ? null : g.id)}
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(g.id, g.name)}
                            disabled={deleting === g.id}
                          >
                            {deleting === g.id
                              ? <span className="spinner-border spinner-border-sm" />
                              : "✕"}
                          </button>
                        </div>

                        {/* Vehicle assignment panel */}
                        {isExpanded && (
                          <div
                            className="px-3 pb-2 pt-1 border-top"
                            style={{ background: "rgba(0,0,0,0.15)" }}
                          >
                            <div
                              className="text-muted mb-1"
                              style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}
                            >
                              Assigned vehicles — enter/exit alerts fire for these
                            </div>
                            {devices.filter((d) => d.traccarId).length === 0 ? (
                              <div className="text-muted small">No devices with Traccar ID</div>
                            ) : (
                              devices.filter((d) => d.traccarId).map((d) => {
                                const key      = `${d.traccarId}-${g.id}`;
                                const isLinked = linked.includes(d.traccarId!);
                                const busy     = togglingKey === key;
                                return (
                                  <div
                                    key={d.id}
                                    className="d-flex align-items-center justify-content-between py-1"
                                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                                  >
                                    <span className="small d-flex align-items-center gap-2">
                                      <span
                                        style={{
                                          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                                          background: d.status === "online" ? "#22c55e" : "#64748b",
                                        }}
                                      />
                                      {d.name}
                                    </span>
                                    <button
                                      className={`btn btn-sm ${isLinked ? "btn-success" : "btn-outline-secondary"}`}
                                      style={{ fontSize: 11, padding: "1px 8px", minWidth: 64 }}
                                      onClick={() => toggleAssignment(d, g.id)}
                                      disabled={busy}
                                    >
                                      {busy
                                        ? <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10 }} />
                                        : isLinked ? "✓ On" : "Off"}
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeofenceManager;
