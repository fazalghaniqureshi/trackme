import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import { getOverdueRecords, getUpcomingRecords } from "../services/maintenanceService";
import { getAllDrivers } from "../services/driverService";
import { getTraccarEvents, isTraccarConfigured } from "../services/traccarService";
import { EVENT_META, knotsToKmh } from "../types/event";
import type { Device } from "../types/device";
import StatCard from './StatCard';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
import { sendNotification, requestNotificationPermission } from '../utils/notifications';

type AlertSeverity = "danger" | "warning" | "info";
type AlertCategory = "maintenance" | "driver" | "traccar" | "idle";

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
  idle: "Idle",
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

      // ── Idle detection ───────────────────────────────────────────
      const IDLE_THRESHOLD_MINUTES = 5;
      if (isTraccarConfigured()) {
        const now = new Date();
        const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        for (const device of devices) {
          if (!device.traccarId) continue;
          try {
            const evts = await getTraccarEvents(device.traccarId, from, now);
            let idleStart: Date | null = null;
            for (const evt of evts) {
              const attrs = (evt as any).attributes ?? {};
              const speed = typeof attrs.speed === 'number' ? attrs.speed : 0;
              const ignition = attrs.ignition === true;
              if (ignition && speed < 1) {
                if (!idleStart) idleStart = new Date(evt.eventTime);
              } else {
                if (idleStart) {
                  const idleMin = (new Date(evt.eventTime).getTime() - idleStart.getTime()) / 60000;
                  if (idleMin >= IDLE_THRESHOLD_MINUTES) {
                    result.push({
                      id: `idle-${device.id}-${idleStart.getTime()}`,
                      severity: "warning",
                      category: "idle",
                      title: `Idle: ${deviceName(device.id)}`,
                      detail: `Engine on, stationary for ${Math.round(idleMin)} min`,
                      timestamp: idleStart,
                    });
                  }
                  idleStart = null;
                }
              }
            }
          } catch {
            // skip if events unavailable
          }
        }
      }

      result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setAlerts(result);
      setLastRefresh(new Date());

      const critical = result.filter((a) => a.severity === "danger");
      if (critical.length > 0) {
        const granted = await requestNotificationPermission();
        if (granted) {
          critical.slice(0, 3).forEach((a) =>
            sendNotification(`Alert: ${a.title}`, a.detail, a.id)
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts
    .filter((a) => filterSeverity === "all" || a.severity === filterSeverity)
    .filter((a) => filterCategory === "all" || a.category === filterCategory);

  const { page, totalPages, paged: pagedAlerts, setPage } = usePagination(filteredAlerts);
  useEffect(() => { setPage(1); }, [filterSeverity, filterCategory]);

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
          { label: "Critical", value: alerts.filter((a) => a.severity === "danger").length, color: "var(--c-danger)" },
          { label: "Warnings", value: alerts.filter((a) => a.severity === "warning").length, color: "var(--c-warning)" },
          { label: "Info", value: alerts.filter((a) => a.severity === "info").length, color: "var(--c-accent)" },
        ].map((c) => (
          <div key={c.label} className="col-4">
            <StatCard label={c.label} value={c.value} color={c.color} />
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
                <option value="idle">Idle</option>
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
              <small className="text-muted">{filteredAlerts.length} alert{filteredAlerts.length !== 1 ? "s" : ""}</small>
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
          ) : filteredAlerts.length === 0 ? (
            <EmptyState
              icon={<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              title="No active alerts"
              message="Everything looks good — no maintenance, driver, or vehicle alerts."
            />
          ) : (
            <>
              <ul className="list-group list-group-flush">
                {pagedAlerts.map((alert) => (
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
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertsCenter;
