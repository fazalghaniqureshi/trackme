import { useState, useEffect } from "react";
import { format, subHours } from "date-fns";
import { getTraccarEvents, isTraccarConfigured } from "../services/traccarService";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import type { TraccarEvent } from "../types/event";
import { EVENT_META } from "../types/event";
import type { Device } from "../types/device";

interface AlertsFeedProps {
  maxItems?: number;
  refreshInterval?: number; // ms, default 60s
}

const AlertsFeed = ({ maxItems = 50, refreshInterval = 60000 }: AlertsFeedProps) => {
  const [events, setEvents] = useState<TraccarEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadEvents = async () => {
    if (!isTraccarConfigured()) return;
    try {
      const deviceList = await getAllDevicesWithTraccar();
      setDevices(deviceList);

      const from = subHours(new Date(), 24);
      const to = new Date();

      const traccarIds = deviceList
        .map((d) => d.traccarId)
        .filter((id): id is number => id !== undefined);

      const allEvents = await Promise.all(
        traccarIds.map((id) =>
          getTraccarEvents(id, from, to, [
            "deviceOverspeed",
            "geofenceEnter",
            "geofenceExit",
            "deviceStopped",
            "deviceMoving",
            "deviceOnline",
            "deviceOffline",
            "ignitionOn",
            "ignitionOff",
          ])
        )
      );

      const merged = allEvents
        .flat()
        .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
        .slice(0, maxItems);

      setEvents(merged);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, refreshInterval);
    return () => clearInterval(interval);
  }, []);

  const getDeviceName = (deviceId: number): string => {
    const device = devices.find((d) => d.traccarId === deviceId);
    return device?.name ?? `Device ${deviceId}`;
  };

  if (!isTraccarConfigured()) return null;

  return (
    <div className="card h-100">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h6 className="mb-0">Recent Events (Last 24h)</h6>
        <div className="d-flex align-items-center gap-2">
          {lastRefresh && (
            <small className="text-muted">Updated {format(lastRefresh, "HH:mm:ss")}</small>
          )}
          <button className="btn btn-sm btn-outline-secondary" onClick={loadEvents} disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm" /> : "↻"}
          </button>
        </div>
      </div>
      <div className="card-body p-0" style={{ maxHeight: 340, overflowY: "auto" }}>
        {loading && events.length === 0 ? (
          <div className="text-center p-4 text-muted">
            <div className="spinner-border spinner-border-sm me-2" />
            Loading events...
          </div>
        ) : events.length === 0 ? (
          <div className="text-center p-4 text-muted">No events in the last 24 hours</div>
        ) : (
          <ul className="list-group list-group-flush">
            {events.map((event) => {
              const meta = EVENT_META[event.type] ?? { label: event.type, color: "secondary" };
              const speedKmh =
                event.attributes?.speed != null
                  ? ` — ${(Number(event.attributes.speed) * 1.852).toFixed(0)} km/h`
                  : "";
              return (
                <li
                  key={event.id}
                  className="list-group-item list-group-item-action py-2 px-3"
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <span className={`badge bg-${meta.color} me-2`}>{meta.label}</span>
                      <span className="fw-semibold small">{getDeviceName(event.deviceId)}</span>
                      {speedKmh && <span className="text-muted small">{speedKmh}</span>}
                    </div>
                    <small className="text-muted text-nowrap ms-2">
                      {format(new Date(event.eventTime), "MMM d, HH:mm")}
                    </small>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AlertsFeed;
