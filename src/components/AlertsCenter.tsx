import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import { getOverdueRecords, getUpcomingRecords } from "../services/maintenanceService";
import { getAllDrivers } from "../services/driverService";
import { getTraccarEvents, isTraccarConfigured } from "../services/traccarService";
import { EVENT_META, knotsToKmh } from "../types/event";
import type { Device } from "../types/device";

type AlertSeverity = "danger" | "warning" | "info";
type AlertCategory = "maintenance" | "driver" | "traccar";

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  detail: string;
  timestamp: Date;
}

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  danger: "Critical",
  warning: "Warning",
  info: "Info",
};

const CATEGORY_LABEL: Record<AlertCategory, string> = {
  maintenance: "Maintenance",
  driver: "Driver",
  traccar: "Vehicle Event",
};

const AlertsCenter = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | "all">("all");
  const [filterCategory, setFilterCategory] = useState<AlertCategory | "all">("all");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const navigate = useNavigate();

  useEffect(() => { loadAlerts(); }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const result: AlertItem[] = [];
      const devices = await getAllDevicesWithTraccar();
      const deviceName = (id: string) =>
        devices.find((d: Device) => d.id === id)?.name ?? id;

      // ── Overdue maintenance ──────────────────────────────────────
      getOverdueRecords().forEach((r) =>
        result.push({
          id: `maint-overdue-${r.id}`,
          severity: "danger",
          category: "maintenance",
          title: `Overdue: ${r.serviceType}`,
          detail: `${deviceName(r.deviceId)} — was due ${r.nextDueDate}`,
          timestamp: new Date(r.nextDueDate + "T00:00:00"),
        })
      );

      // ── Upcoming maintenance ─────────────────────────────────────
      getUpcomingRecords(30).forEach((r) => {
        const days = Math.ceil((new Date(r.nextDueDate!).getTime() - Date.now()) / 86400000);
        result.push({
          id: `maint-upcoming-${r.id}`,
          severity: "warning",
          category: "maintenance",
          title: `Due Soon: ${r.serviceType}`,
          detail: `${deviceName(r.deviceId)} — due in ${days}d (${r.nextDueDate})`,
          timestamp: new Date(r.nextDueDate + "T00:00:00"),
        });
      });

      // ── Driver license alerts ────────────────────────────────────
      getAllDrivers().forEach((d) => {
        const days = Math.ceil(
          (new Date(d.licenseExpiry).getTime() - Date.now()) / 86400000
        );
        if (days < 0) {
          result.push({
            id: `driver-expired-${d.id}`,
            severity: "danger",
            category: "driver",
            title: `License Expired: ${d.name}`,
            detail: `#${d.licenseNumber} — expired ${d.licenseExpiry}`,
            timestamp: new Date(d.licenseExpiry + "T00:00:00"),
          });
        } else if (days <= 30) {
          result.push({
            id: `driver-expiring-${d.id}`,
            severity: "warning",
            category: "driver",
            title: `License Expiring: ${d.name}`,
            detail: `#${d.licenseNumber} — expires in ${days}d (${d.licenseExpiry})`,
            timestamp: new Date(d.licenseExpiry + "T00:00:00"),
          });
        }
      });

      // ── Traccar events (last 24 h) ───────────────────────────────
      if (isTraccarConfigured()) {
        const from = new Date(Date.now() - 86400000);
        const to = new Date();
        const traccarIds = devices
          .map((d: Device) => d.traccarId)
          .filter((id): id is number => id !== undefined);

        const allEvents = (
          await Promise.all(
            traccarIds.map((tid) =>
              getTraccarEvents(tid, from, to, [
                "deviceOverspeed",
                "geofenceEnter",
                "geofenceExit",
              ])
            )
          )
        ).flat();

        allEvents.forEach((ev) => {
          const meta = EVENT_META[ev.type] ?? { label: ev.type, color: "secondary" };
          const devName =
            devices.find((d: Device) => d.traccarId === ev.deviceId)?.name ??
            `Device ${ev.deviceId}`;
          const speedStr =
            ev.attributes?.speed != null
              ? ` — ${knotsToKmh(Number(ev.attributes.speed)).toFixed(0)} km/h`
              : "";
          result.push({
            id: `traccar-${ev.id}`,
            severity: ev.type === "deviceOverspeed" ? "danger" : "info",
            category: "traccar",
            title: `${meta.label}: ${devName}`,
            detail: `${format(new Date(ev.eventTime), "MMM d, HH:mm:ss")}${speedStr}`,
            timestamp: new Date(ev.eventTime),
          });
        });
      }

      result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setAlerts(result);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  };

  const filtered = alerts
    .filter((a) => filterSeverity === "all" || a.severity === filterSeverity)
    .filter((a) => filterCategory === "all" || a.category === filterCategory);

  const dangerCount = alerts.filter((a) => a.severity === "danger").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const infoCount = alerts.filter((a) => a.severity === "info").length;

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="mb-0">Alerts Center</h1>
          {lastRefresh && (
            <small className="text-muted">
              Last updated {format(lastRefresh, "HH:mm:ss")}
            </small>
          )}
        </div>
        <button className="btn btn-outline-primary" onClick={loadAlerts} disabled={loading}>
          {loading ? <span className="spinner-border spinner-border-sm me-1" /> : "↻ "}
          Refresh
        </button>
      </div>

      {/* KPI summary */}
      <div className="row g-3 mb-4">
        {[
          { label: "Critical", count: dangerCount, color: "danger", severity: "danger" as AlertSeverity },
          { label: "Warnings", count: warningCount, color: "warning", severity: "warning" as AlertSeverity },
          { label: "Info", count: infoCount, color: "info", severity: "info" as AlertSeverity },
        ].map((c) => (
          <div key={c.label} className="col-4">
            <div
              className={`card text-white bg-${c.color} h-100`}
              style={{ cursor: "pointer" }}
              onClick={() =>
                setFilterSeverity((prev) => (prev === c.severity ? "all" : c.severity))
              }
            >
              <div className="card-body py-3">
                <div className="small opacity-75">{c.label}</div>
                <div className="fs-3 fw-bold">{c.count}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label fw-semibold">Severity</label>
              <select
                className="form-select"
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as AlertSeverity | "all")}
              >
                <option value="all">All Severities</option>
                <option value="danger">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold">Category</label>
              <select
                className="form-select"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as AlertCategory | "all")}
              >
                <option value="all">All Categories</option>
                <option value="maintenance">Maintenance</option>
                <option value="driver">Driver</option>
                <option value="traccar">Vehicle Events</option>
              </select>
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => { setFilterSeverity("all"); setFilterCategory("all"); }}
              >
                Clear
              </button>
            </div>
            <div className="col-md-2 text-end">
              <small className="text-muted">{filtered.length} alert{filtered.length !== 1 ? "s" : ""}</small>
            </div>
          </div>
        </div>
      </div>

      {/* Alert list */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border me-2" />
              <p className="mt-2 mb-0">Loading alerts…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <div className="fs-1 mb-2">✓</div>
              <p className="mb-0">
                {alerts.length === 0
                  ? "No active alerts — everything looks good!"
                  : "No alerts match the current filters."}
              </p>
            </div>
          ) : (
            <ul className="list-group list-group-flush">
              {filtered.map((alert) => (
                <li
                  key={alert.id}
                  className={`list-group-item list-group-item-action border-start border-${alert.severity} border-3`}
                  style={{ borderLeftWidth: "4px !important" }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="d-flex align-items-start gap-2 flex-wrap">
                      <span className={`badge bg-${alert.severity} mt-1`}>
                        {SEVERITY_LABEL[alert.severity]}
                      </span>
                      <span className="badge bg-secondary mt-1">
                        {CATEGORY_LABEL[alert.category]}
                      </span>
                      <div>
                        <div className="fw-semibold">{alert.title}</div>
                        <div className="text-muted small">{alert.detail}</div>
                      </div>
                    </div>
                    <div className="d-flex flex-column align-items-end gap-1 ms-3">
                      <small className="text-muted text-nowrap">
                        {format(alert.timestamp, "MMM d, HH:mm")}
                      </small>
                      {alert.category === "maintenance" && (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => navigate("/maintenance")}
                        >
                          View
                        </button>
                      )}
                      {alert.category === "driver" && (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => navigate("/drivers")}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertsCenter;
