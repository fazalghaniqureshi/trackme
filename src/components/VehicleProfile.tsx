import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { format, subDays } from "date-fns";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import { getDriverByDeviceId } from "../services/driverService";
import { getMaintenanceByDevice } from "../services/maintenanceService";
import { getFuelEntriesByDevice } from "../services/fuelService";
import { getTraccarTrips, isTraccarConfigured } from "../services/traccarService";
import { knotsToKmh, metersToKm } from "../types/event";
import type { Device } from "../types/device";
import type { Driver } from "../types/driver";
import type { MaintenanceRecord } from "../types/maintenance";
import type { FuelEntry } from "../types/fuel";
import type { TraccarTripReport } from "../types/event";

import iconBlue from "../assets/images/icon_blue.png";
import iconGray from "../assets/images/icon_gray.png";

const makeMarkerIcon = (online: boolean) =>
  new L.Icon({
    iconUrl: online ? iconBlue : iconGray,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });

type Tab = "maintenance" | "fuel" | "trips";

const VehicleProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [device, setDevice] = useState<Device | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [fuel, setFuel] = useState<FuelEntry[]>([]);
  const [trips, setTrips] = useState<TraccarTripReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("maintenance");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadProfile(id);
  }, [id]);

  useEffect(() => {
    if (!device?.traccarId || activeTab !== "trips") return;
    if (trips.length > 0) return; // already loaded
    loadTrips(device.traccarId);
  }, [activeTab, device]);

  const loadProfile = async (deviceId: string) => {
    setLoading(true);
    try {
      const devices = await getAllDevicesWithTraccar();
      const found = devices.find((d) => d.id === deviceId);
      if (!found) { setNotFound(true); return; }

      setDevice(found);
      setDriver(getDriverByDeviceId(deviceId) ?? null);
      setMaintenance(getMaintenanceByDevice(deviceId));
      setFuel(getFuelEntriesByDevice(deviceId));
    } finally {
      setLoading(false);
    }
  };

  const loadTrips = async (traccarId: number) => {
    setTripsLoading(true);
    try {
      const from = subDays(new Date(), 7);
      const to = new Date();
      setTrips(await getTraccarTrips(traccarId, from, to));
    } finally {
      setTripsLoading(false);
    }
  };

  const fmt2 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ height: "60vh" }}>
        <div className="text-center text-muted">
          <div className="spinner-border mb-3" />
          <p>Loading vehicle profile…</p>
        </div>
      </div>
    );
  }

  if (notFound || !device) {
    return (
      <div className="container p-4">
        <div className="alert alert-warning">
          Vehicle not found. <button className="btn btn-link p-0" onClick={() => navigate(-1)}>Go back</button>
        </div>
      </div>
    );
  }

  const statusColor =
    device.status === "online" ? "success" : device.status === "offline" ? "danger" : "secondary";

  const hasCoords = device.coords[0] !== 0 || device.coords[1] !== 0;

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1 className="mb-0">{device.name}</h1>
        <span className={`badge bg-${statusColor} fs-6`}>{device.status.toUpperCase()}</span>
      </div>

      <div className="row g-3 mb-4">
        {/* Mini-map */}
        <div className="col-md-5">
          <div className="card h-100">
            <div className="card-header"><strong>Current Location</strong></div>
            <div className="card-body p-0" style={{ minHeight: 280 }}>
              {hasCoords ? (
                <MapContainer
                  center={device.coords}
                  zoom={14}
                  style={{ height: 280, width: "100%", borderRadius: "0 0 0.375rem 0.375rem" }}
                  zoomControl={false}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
                  />
                  <Marker
                    position={device.coords}
                    icon={makeMarkerIcon(device.status === "online")}
                  />
                </MapContainer>
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted py-5">
                  No position data
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live stats */}
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header"><strong>Live Stats</strong></div>
            <div className="card-body">
              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <th className="text-muted fw-normal">Model</th>
                    <td>{device.model}</td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">IMEI</th>
                    <td><code>{device.imei}</code></td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Speed</th>
                    <td>{device.speed != null ? `${device.speed.toFixed(0)} km/h` : "—"}</td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Heading</th>
                    <td>{device.angle != null ? `${device.angle}°` : "—"}</td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Battery</th>
                    <td>
                      {device.battery != null ? (
                        <span className={device.battery < 20 ? "text-danger fw-semibold" : ""}>
                          {device.battery}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Signal</th>
                    <td>{device.signal != null ? `${device.signal} dBm` : "—"}</td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Last Update</th>
                    <td>
                      <small>
                        {device.lastUpdate
                          ? format(new Date(device.lastUpdate), "MMM d, HH:mm:ss")
                          : "Never"}
                      </small>
                    </td>
                  </tr>
                  {device.description && (
                    <tr>
                      <th className="text-muted fw-normal">Notes</th>
                      <td><small>{device.description}</small></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Assigned driver */}
        <div className="col-md-3">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Assigned Driver</strong>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => navigate("/drivers")}
              >
                Manage
              </button>
            </div>
            <div className="card-body">
              {driver ? (
                <>
                  <div className="fs-5 fw-semibold mb-2">{driver.name}</div>
                  <table className="table table-sm mb-0">
                    <tbody>
                      <tr>
                        <th className="text-muted fw-normal">License</th>
                        <td>{driver.licenseNumber}</td>
                      </tr>
                      <tr>
                        <th className="text-muted fw-normal">Expires</th>
                        <td>
                          {(() => {
                            const days = Math.ceil(
                              (new Date(driver.licenseExpiry).getTime() - Date.now()) / 86400000
                            );
                            return (
                              <span className={days < 0 ? "text-danger" : days <= 30 ? "text-warning" : ""}>
                                {driver.licenseExpiry}
                                {days < 0 ? " (expired)" : days <= 30 ? ` (${days}d)` : ""}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                      {driver.phone && (
                        <tr>
                          <th className="text-muted fw-normal">Phone</th>
                          <td>{driver.phone}</td>
                        </tr>
                      )}
                      {driver.email && (
                        <tr>
                          <th className="text-muted fw-normal">Email</th>
                          <td><small>{driver.email}</small></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="text-center text-muted py-4">
                  <div className="mb-2">No driver assigned</div>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => navigate("/drivers")}
                  >
                    Assign Driver
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="card-header p-0">
          <ul className="nav nav-tabs card-header-tabs ms-0">
            {(
              [
                { key: "maintenance" as Tab, label: `🔧 Maintenance (${maintenance.length})` },
                { key: "fuel" as Tab, label: `⛽ Fuel Log (${fuel.length})` },
                ...(isTraccarConfigured()
                  ? [{ key: "trips" as Tab, label: "🗺️ Trips (last 7d)" }]
                  : []),
              ] as { key: Tab; label: string }[]
            ).map((tab) => (
              <li key={tab.key} className="nav-item">
                <button
                  className={`nav-link ${activeTab === tab.key ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card-body p-0">
          {/* Maintenance tab */}
          {activeTab === "maintenance" && (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Service</th>
                    <th>Odometer</th>
                    <th>Cost</th>
                    <th>Next Due</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenance.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No maintenance records.{" "}
                        <button
                          className="btn btn-link p-0"
                          onClick={() => navigate("/maintenance")}
                        >
                          Add one
                        </button>
                      </td>
                    </tr>
                  ) : (
                    maintenance.map((r) => (
                      <tr key={r.id}>
                        <td>{r.serviceDate}</td>
                        <td className="fw-semibold">{r.serviceType}</td>
                        <td>{r.odometer ? `${r.odometer.toLocaleString()} km` : "—"}</td>
                        <td>{r.cost ? fmt2(r.cost) : "—"}</td>
                        <td>
                          {r.nextDueDate ? (
                            (() => {
                              const days = Math.ceil(
                                (new Date(r.nextDueDate).getTime() - Date.now()) / 86400000
                              );
                              return (
                                <span className={days < 0 ? "text-danger" : days <= 30 ? "text-warning" : ""}>
                                  {r.nextDueDate}
                                  {days < 0 ? " (overdue)" : days <= 30 ? ` (${days}d)` : ""}
                                </span>
                              );
                            })()
                          ) : "—"}
                        </td>
                        <td><small className="text-muted">{r.notes || "—"}</small></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Fuel tab */}
          {activeTab === "fuel" && (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Liters</th>
                    <th>Cost/L</th>
                    <th>Total Cost</th>
                    <th>Odometer</th>
                    <th>Efficiency</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {fuel.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        No fuel records.{" "}
                        <button
                          className="btn btn-link p-0"
                          onClick={() => navigate("/fuel")}
                        >
                          Add one
                        </button>
                      </td>
                    </tr>
                  ) : (
                    fuel.map((e) => (
                      <tr key={e.id}>
                        <td>{e.date}</td>
                        <td>{fmt2(e.liters)} L</td>
                        <td>{fmt2(e.costPerLiter)}</td>
                        <td className="fw-semibold">{fmt2(e.liters * e.costPerLiter)}</td>
                        <td>{e.odometer ? `${e.odometer.toLocaleString()} km` : "—"}</td>
                        <td>
                          {e.fuelEfficiency != null
                            ? `${e.fuelEfficiency.toFixed(1)} km/L`
                            : <span className="text-muted">—</span>}
                        </td>
                        <td><small className="text-muted">{e.notes || "—"}</small></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Trips tab */}
          {activeTab === "trips" && (
            tripsLoading ? (
              <div className="text-center py-5 text-muted">
                <div className="spinner-border me-2" />
                <p className="mt-2 mb-0">Loading trips…</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Start</th>
                      <th>End</th>
                      <th>Distance</th>
                      <th>Duration</th>
                      <th>Max Speed</th>
                      <th>Avg Speed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No trips in the last 7 days.
                        </td>
                      </tr>
                    ) : (
                      trips.map((t, i) => {
                        const durationMs = t.duration;
                        const hours = Math.floor(durationMs / 3600000);
                        const mins = Math.floor((durationMs % 3600000) / 60000);
                        return (
                          <tr key={i}>
                            <td>
                              <div>{format(new Date(t.startTime), "MMM d, HH:mm")}</div>
                              {t.startAddress && (
                                <small className="text-muted">{t.startAddress}</small>
                              )}
                            </td>
                            <td>
                              <div>{format(new Date(t.endTime), "MMM d, HH:mm")}</div>
                              {t.endAddress && (
                                <small className="text-muted">{t.endAddress}</small>
                              )}
                            </td>
                            <td>{metersToKm(t.distance).toFixed(1)} km</td>
                            <td>{hours > 0 ? `${hours}h ` : ""}{mins}m</td>
                            <td>{knotsToKmh(t.maxSpeed).toFixed(0)} km/h</td>
                            <td>{knotsToKmh(t.averageSpeed).toFixed(0)} km/h</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default VehicleProfile;
