import { useState, useEffect } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import {
  getTraccarTrips,
  getTraccarSummary,
  getTraccarEvents,
  isTraccarConfigured,
} from "../services/traccarService";
import type { TraccarTripReport, TraccarSummaryReport, TraccarEvent } from "../types/event";
import { knotsToKmh, metersToKm, msDuration, EVENT_META } from "../types/event";
import type { Device } from "../types/device";

type ReportTab = "trips" | "summary" | "events";

const getPresetDates = (preset: "today" | "week" | "month") => {
  const now = new Date();
  if (preset === "today") return { from: format(now, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
  if (preset === "week") return { from: format(subDays(now, 7), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
  return { from: format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
};

const Reports = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [activeTab, setActiveTab] = useState<ReportTab>("trips");
  const [preset, setPreset] = useState<"today" | "week" | "month" | "custom">("week");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trips, setTrips] = useState<TraccarTripReport[]>([]);
  const [summaries, setSummaries] = useState<TraccarSummaryReport[]>([]);
  const [events, setEvents] = useState<TraccarEvent[]>([]);

  const navigate = useNavigate();

  // Load device list on mount
  useEffect(() => {
    getAllDevicesWithTraccar().then(setDevices);
  }, []);

  // Reload when filters change
  useEffect(() => {
    loadData();
  }, [selectedDevice, startDate, endDate]);

  const loadData = async () => {
    if (!isTraccarConfigured()) {
      setError("Connect to Traccar first.");
      return;
    }
    setLoading(true);
    setError(null);

    const from = startOfDay(new Date(startDate));
    const to = endOfDay(new Date(endDate));

    try {
      const deviceList = await getAllDevicesWithTraccar();
      setDevices(deviceList);

      const traccarIds =
        selectedDevice === "all"
          ? deviceList.map((d) => d.traccarId).filter((id): id is number => id !== undefined)
          : deviceList.find((d) => d.id === selectedDevice)?.traccarId
          ? [deviceList.find((d) => d.id === selectedDevice)!.traccarId!]
          : [];

      if (traccarIds.length === 0) {
        setTrips([]);
        setSummaries([]);
        setEvents([]);
        return;
      }

      const [allTrips, allSummaries, allEvents] = await Promise.all([
        Promise.all(traccarIds.map((id) => getTraccarTrips(id, from, to))).then((r) => r.flat()),
        getTraccarSummary(from, to, selectedDevice !== "all" ? traccarIds[0] : undefined),
        selectedDevice !== "all"
          ? getTraccarEvents(traccarIds[0], from, to)
          : Promise.resolve([] as TraccarEvent[]),
      ]);

      setTrips(allTrips.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      setSummaries(allSummaries);
      setEvents(allEvents.sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime()));
    } catch (e) {
      setError("Failed to load report data. Check your Traccar connection.");
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (p: "today" | "week" | "month") => {
    setPreset(p);
    const { from, to } = getPresetDates(p);
    setStartDate(from);
    setEndDate(to);
  };

  const getDeviceName = (deviceId: number) =>
    devices.find((d) => d.traccarId === deviceId)?.name ?? `Device ${deviceId}`;

  const exportCSV = () => {
    const headers = ["Device", "Start", "End", "Duration", "Distance (km)", "Max Speed (km/h)", "Avg Speed (km/h)"];
    const rows = trips.map((t) => [
      t.deviceName,
      format(new Date(t.startTime), "yyyy-MM-dd HH:mm:ss"),
      format(new Date(t.endTime), "yyyy-MM-dd HH:mm:ss"),
      msDuration(t.duration),
      metersToKm(t.distance).toFixed(2),
      knotsToKmh(t.maxSpeed).toFixed(1),
      knotsToKmh(t.averageSpeed).toFixed(1),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fleet-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isTraccarConfigured()) {
    return (
      <div className="container p-5 text-center">
        <h4 className="text-muted">Traccar not connected</h4>
        <p className="text-muted">Connect to Traccar to view fleet reports.</p>
        <button className="btn btn-primary" onClick={() => navigate("/traccar")}>
          Connect to Traccar
        </button>
      </div>
    );
  }

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Fleet Reports</h1>
        <button className="btn btn-outline-success" onClick={exportCSV} disabled={trips.length === 0}>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex gap-2 mb-3 flex-wrap">
            {(["today", "week", "month", "custom"] as const).map((p) => (
              <button
                key={p}
                className={`btn btn-sm ${preset === p ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => p === "custom" ? setPreset("custom") : applyPreset(p)}
              >
                {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom"}
              </button>
            ))}
          </div>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold">Device</label>
              <select
                className="form-select"
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
              >
                <option value="all">All Devices</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            {preset === "custom" && (
              <>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-primary w-100" onClick={loadData} disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        {(["trips", "summary", "events"] as ReportTab[]).map((tab) => (
          <li key={tab} className="nav-item">
            <button
              className={`nav-link ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "trips" ? `Trips (${trips.length})`
                : tab === "summary" ? `Summary (${summaries.length})`
                : `Events (${events.length})`}
            </button>
          </li>
        ))}
      </ul>

      {/* ── Trips ── */}
      {activeTab === "trips" && (
        <div className="card">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Device</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Duration</th>
                    <th>Distance</th>
                    <th>Max Speed</th>
                    <th>Avg Speed</th>
                    <th>Route</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        {loading ? "Loading trips…" : "No trips found for this period"}
                      </td>
                    </tr>
                  ) : (
                    trips.map((trip, i) => (
                      <tr key={i}>
                        <td className="fw-semibold">{trip.deviceName}</td>
                        <td>
                          <small>{format(new Date(trip.startTime), "MMM d, HH:mm")}</small>
                          {trip.startAddress && (
                            <><br /><small className="text-muted">{trip.startAddress}</small></>
                          )}
                        </td>
                        <td>
                          <small>{format(new Date(trip.endTime), "MMM d, HH:mm")}</small>
                          {trip.endAddress && (
                            <><br /><small className="text-muted">{trip.endAddress}</small></>
                          )}
                        </td>
                        <td>{msDuration(trip.duration)}</td>
                        <td>{metersToKm(trip.distance).toFixed(2)} km</td>
                        <td>
                          <span className={knotsToKmh(trip.maxSpeed) > 120 ? "text-danger fw-bold" : ""}>
                            {knotsToKmh(trip.maxSpeed).toFixed(0)} km/h
                          </span>
                        </td>
                        <td>{knotsToKmh(trip.averageSpeed).toFixed(0)} km/h</td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              const device = devices.find((d) => d.traccarId === trip.deviceId);
                              if (device) navigate(`/?device=${device.id}&from=${trip.startTime}&to=${trip.endTime}`);
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary ── */}
      {activeTab === "summary" && (
        <div className="card">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Device</th>
                    <th>Total Distance</th>
                    <th>Max Speed</th>
                    <th>Avg Speed</th>
                    <th>Engine Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        {loading ? "Loading summary…" : "No data for this period"}
                      </td>
                    </tr>
                  ) : (
                    summaries.map((s, i) => (
                      <tr key={i}>
                        <td className="fw-semibold">{s.deviceName}</td>
                        <td>{metersToKm(s.distance).toFixed(2)} km</td>
                        <td>{knotsToKmh(s.maxSpeed).toFixed(0)} km/h</td>
                        <td>{knotsToKmh(s.averageSpeed).toFixed(0)} km/h</td>
                        <td>{s.engineHours ? msDuration(s.engineHours) : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Events ── */}
      {activeTab === "events" && (
        <div className="card">
          <div className="card-body p-0">
            {selectedDevice === "all" ? (
              <div className="p-4 text-center text-muted">
                Select a specific device to view its events.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Type</th>
                      <th>Device</th>
                      <th>Time</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-4">
                          {loading ? "Loading events…" : "No events found for this period"}
                        </td>
                      </tr>
                    ) : (
                      events.map((event) => {
                        const meta = EVENT_META[event.type] ?? { label: event.type, color: "secondary" };
                        return (
                          <tr key={event.id}>
                            <td>
                              <span className={`badge bg-${meta.color}`}>{meta.label}</span>
                            </td>
                            <td>{getDeviceName(event.deviceId)}</td>
                            <td>{format(new Date(event.eventTime), "MMM d, HH:mm:ss")}</td>
                            <td>
                              {event.attributes?.speed != null && (
                                <small>{knotsToKmh(Number(event.attributes.speed)).toFixed(0)} km/h</small>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
