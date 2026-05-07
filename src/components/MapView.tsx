import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  Circle,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-rotatedmarker";
import "leaflet.marker.slideto";
import L from "leaflet";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import "../assets/MapView.css";
import carGray from "../assets/images/icon_gray.png";
import carBlue from "../assets/images/icon_blue.png";
import type { Device } from "../types/device";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import {
  isTraccarConfigured,
  setupTraccarWebSocket,
  restoreTraccarSession,
  getTraccarLocationHistory,
  getTraccarGeofences,
  sendTraccarCommand,
  type TraccarPosition,
  type CommandType,
} from "../services/traccarService";
import type { LocationPoint } from "../types/trip";
import type { TraccarGeofence } from "../types/geofence";
import { calculateDistance } from "../services/analyticsService";
import { reverseGeocode } from "../services/geocodingService";
import { useNavigate } from "react-router-dom";
import MarkerClusterGroup from 'react-leaflet-cluster';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const defaultIcon = new L.Icon({
  iconUrl: carGray,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const selectedIcon = new L.Icon({
  iconUrl: carBlue,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

const playheadIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#f59e0b;border:3px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
}) as unknown as L.Icon;

/** Returns a speeding-alert icon (car image + pulsing red dot overlay). */
const makeSpeedingIcon = (selected: boolean): L.Icon => {
  const src = selected ? carBlue : carGray;
  const size = selected ? 48 : 40;
  const anchor = size / 2;
  return new L.DivIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px"><img src="${src}" style="width:${size}px;height:${size}px" /><span class="speeding-badge"></span></div>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  }) as unknown as L.Icon;
};

const makeIcon = (selected: boolean, speeding: boolean): L.Icon =>
  speeding ? makeSpeedingIcon(selected) : selected ? selectedIcon : defaultIcon;

// ---------------------------------------------------------------------------
// WKT helper (circle geofences)
// ---------------------------------------------------------------------------

const parseCircleWKT = (
  area: string
): { lat: number; lng: number; radius: number } | null => {
  const m = area.match(
    /CIRCLE\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([\d.]+)\s*\)/i
  );
  if (!m) return null;
  return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), radius: parseFloat(m[3]) };
};

const GEOFENCE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

// ---------------------------------------------------------------------------
// Route helpers: speed colour + direction bearing
// ---------------------------------------------------------------------------

const SPEED_BUCKET = 6; // km/h — group consecutive points into colour bands

/** Interpolate green→yellow→red based on speed vs limit */
const speedToColor = (speed: number, limit: number): string => {
  if (limit <= 0) return "#3b82f6";
  const t = Math.max(0, Math.min(speed / limit, 1));
  if (t <= 0.5) {
    const u = t * 2;
    // green #22c55e → yellow #eab308
    return `rgb(${Math.round(34 + 200 * u)},${Math.round(197 - 18 * u)},${Math.round(94 - 86 * u)})`;
  }
  const u = (t - 0.5) * 2;
  // yellow #eab308 → red #ef4444
  return `rgb(${Math.round(234 + 5 * u)},${Math.round(179 - 111 * u)},${Math.round(8 + 60 * u)})`;
};

/** Compass bearing from point a to b (degrees, 0 = North) */
const bearingDeg = (a: [number, number], b: [number, number]): number => {
  const la = (a[0] * Math.PI) / 180, lb = (b[0] * Math.PI) / 180;
  const dl = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(lb);
  const x = Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/** Arrow DivIcon rotated to bearing */
const makeArrowIcon = (angle: number): L.Icon =>
  new L.DivIcon({
    className: "",
    html: `<div class="route-arrow" style="transform:rotate(${angle}deg)">▲</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  }) as unknown as L.Icon;

// ---------------------------------------------------------------------------
// Map fly-to helper
// ---------------------------------------------------------------------------

const MapFlyTo = ({ coords, zoom = 15 }: { coords: [number, number]; zoom?: number }) => {
  const map = useMap();
  useEffect(() => { map.flyTo(coords, zoom); }, []);
  return null;
};

// ---------------------------------------------------------------------------
// Tile layer URLs
// ---------------------------------------------------------------------------

const TILE_LAYERS = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri — Maxar",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; CartoDB",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type WsStatus = "connecting" | "live" | "polling";
type MapType = "street" | "satellite" | "dark";

const MapView = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapType, setMapType] = useState<MapType>("street");
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const [shouldFly, setShouldFly] = useState(false);
  const [followMode, setFollowMode] = useState(false);

  // Address cache for sidebar
  const [addresses, setAddresses] = useState<Record<string, string>>({});

  // Geofences
  const [initialLoading, setInitialLoading] = useState(true);
  const [geofences, setGeofences] = useState<TraccarGeofence[]>([]);
  const [showGeofences, setShowGeofences] = useState(true);

  // Speed limit alert
  const [speedLimit, setSpeedLimit] = useState(120);

  // Commands modal
  const [showCommandsModal, setShowCommandsModal] = useState(false);
  const [commandSending, setCommandSending] = useState<CommandType | null>(null);
  const [commandResult, setCommandResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [mobileTab, setMobileTab] = useState<"vehicles" | "trip" | "commands" | null>(null);

  // Trip history / route replay
  const [tripStart, setTripStart] = useState<string>(() =>
    new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [tripEnd, setTripEnd] = useState<string>(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [routeLocations, setRouteLocations] = useState<LocationPoint[]>([]);
  const [routeSummary, setRouteSummary] = useState<{
    distance: number;
    start?: Date;
    end?: Date;
    maxSpeed?: number;
  } | null>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const [routeCenter, setRouteCenter] = useState<[number, number] | null>(null);

  // Route playback
  const [playheadIdx, setPlayheadIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const markerRefs = useRef<Record<string, any>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const wsActiveRef = useRef(false);
  const lastGeocodedCoordsRef = useRef<Record<string, [number, number]>>({});

  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const isSpeeding = (d: Device) =>
    d.speed !== undefined && d.speed > speedLimit && d.status === "online";
  const speedingCount = devices.filter(isSpeeding).length;

  // ---------------------------------------------------------------------------
  // Device loading
  // ---------------------------------------------------------------------------

  const loadDevices = useCallback(async () => {
    const loaded = await getAllDevicesWithTraccar();
    setDevices((prev) => {
      loaded.forEach((device) => {
        const prev_device = prev.find((p) => p.id === device.id);
        if (
          prev_device &&
          (prev_device.coords[0] !== device.coords[0] ||
            prev_device.coords[1] !== device.coords[1])
        ) {
          const marker = markerRefs.current[device.id];
          if (marker?.slideTo) {
            marker.setRotationAngle(device.angle);
            marker.slideTo(device.coords, { duration: 800, keepAtCenter: false });
          }
        }
      });
      return loaded;
    });
    if (!selectedId && loaded.length > 0) setSelectedId(loaded[0].id);
  }, [selectedId]);

  // ---------------------------------------------------------------------------
  // Initialise on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const init = async () => {
      await restoreTraccarSession();
      await loadDevices();
      if (isTraccarConfigured()) {
        getTraccarGeofences().then(setGeofences);
      }
      setInitialLoading(false);
    };
    init();
    const fastPoll = setInterval(() => {
      if (!wsActiveRef.current) loadDevices();
    }, 5000);
    const heartbeat = setInterval(loadDevices, 30000);
    return () => {
      clearInterval(fastPoll);
      clearInterval(heartbeat);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // WebSocket real-time updates
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isTraccarConfigured()) {
      setWsStatus("polling");
      return;
    }
    let cancelled = false;

    const connect = async () => {
      const ws = await setupTraccarWebSocket(
        (deviceId: number, position: TraccarPosition) => {
          if (cancelled) return;
          wsActiveRef.current = true;
          setWsStatus("live");

          setDevices((prev) =>
            prev.map((device) => {
              if (device.traccarId !== deviceId) return device;
              const newCoords: [number, number] = [position.latitude, position.longitude];

              const marker = markerRefs.current[device.id];
              if (marker?.slideTo) {
                marker.setRotationAngle(position.course);
                marker.slideTo(newCoords, { duration: 800, keepAtCenter: false });
              }

              return {
                ...device,
                prevCoords: device.coords,
                coords: newCoords,
                angle: position.course,
                speed: position.speed * 1.852,
                battery:
                  (position.attributes?.batteryLevel as number | undefined) ?? device.battery,
                signal: (position.attributes?.rssi as number | undefined) ?? device.signal,
                lastUpdate: new Date(position.fixTime),
                status: "online",
              };
            })
          );
        },
        (deviceId: number, status: string) => {
          if (cancelled) return;
          setDevices((prev) =>
            prev.map((d) =>
              d.traccarId === deviceId ? { ...d, status: status as Device["status"] } : d
            )
          );
        },
        () => { if (!cancelled) setWsStatus("live"); },
        () => { if (!cancelled) { wsActiveRef.current = false; setWsStatus("polling"); } }
      );

      if (!cancelled && ws) wsRef.current = ws;
      else if (!cancelled) setWsStatus("polling");
    };

    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-geocode selected device when it moves > 200 m
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!selectedId) return;
    const device = devices.find((d) => d.id === selectedId);
    if (!device || device.coords[0] === 0 && device.coords[1] === 0) return;

    const lastPos = lastGeocodedCoordsRef.current[selectedId];
    const movedFar = lastPos
      ? calculateDistance(lastPos, device.coords) > 0.2
      : true; // always geocode on first selection

    if (!movedFar) return;

    lastGeocodedCoordsRef.current[selectedId] = device.coords;
    reverseGeocode(device.coords[0], device.coords[1]).then((addr) => {
      setAddresses((prev) => ({ ...prev, [selectedId]: addr }));
    });
  }, [selectedId, devices]);

  // ---------------------------------------------------------------------------
  // Keep marker rotation in sync with device heading (imperative — react-leaflet
  // v5 does not re-apply unknown props like rotationAngle on updates)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    devices.forEach((device) => {
      const marker = markerRefs.current[device.id];
      if (marker?.setRotationAngle) {
        marker.setRotationAngle(device.angle ?? 0);
      }
    });
  }, [devices]);

  // ---------------------------------------------------------------------------
  // Follow mode
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (followMode && selectedId && shouldFly) setShouldFly(false);
  }, [devices]);

  // ---------------------------------------------------------------------------
  // Route playback
  // ---------------------------------------------------------------------------

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    playbackTimerRef.current = null;
  }, []);

  const startPlayback = useCallback(() => {
    stopPlayback();
    setIsPlaying(true);
    setPlayheadIdx(0);
    playbackTimerRef.current = setInterval(() => {
      setPlayheadIdx((prev) => {
        if (prev >= routeLocations.length - 1) {
          stopPlayback();
          return prev;
        }
        return prev + 1;
      });
    }, 200 / playbackSpeed);
  }, [routeLocations, playbackSpeed, stopPlayback]);

  useEffect(() => () => stopPlayback(), []);

  // ---------------------------------------------------------------------------
  // Trip history load
  // ---------------------------------------------------------------------------

  const handleTripHistory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isTraccarConfigured()) { setTripError("Connect to Traccar to view trip history."); return; }
    const device = devices.find((d) => d.id === selectedId);
    if (!device?.traccarId) { setTripError("Select a Traccar-synced device."); return; }

    const startDate = new Date(tripStart);
    const endDate = new Date(tripEnd);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { setTripError("Invalid date range."); return; }
    if (startDate >= endDate) { setTripError("Start must be before end."); return; }

    setTripLoading(true);
    setTripError(null);
    setRouteLocations([]);
    setRouteSummary(null);
    stopPlayback();

    try {
      const locations = await getTraccarLocationHistory(device.traccarId, startDate, endDate);
      if (locations.length === 0) { setTripError("No data found for this time range."); return; }

      setRouteLocations(locations);
      setRouteCenter(locations[Math.floor(locations.length / 2)].coords);

      let distance = 0;
      let maxSpeed = 0;
      for (let i = 1; i < locations.length; i++) {
        distance += calculateDistance(locations[i - 1].coords, locations[i].coords);
        if (locations[i].speed > maxSpeed) maxSpeed = locations[i].speed;
      }
      setRouteSummary({
        distance,
        start: locations[0].timestamp,
        end: locations[locations.length - 1].timestamp,
        maxSpeed,
      });
    } catch {
      setTripError("Failed to load trip data.");
    } finally {
      setTripLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Speed-coloured route segments (bucketised for performance)
  // ---------------------------------------------------------------------------

  const speedSegments = useMemo((): { points: [number, number][]; color: string }[] => {
    if (routeLocations.length < 2) return [];
    const bucket = (s: number) => Math.round(s / SPEED_BUCKET) * SPEED_BUCKET;
    const segments: { points: [number, number][]; color: string }[] = [];
    let curBucket = bucket(routeLocations[0].speed);
    let curPts: [number, number][] = [routeLocations[0].coords];

    for (let i = 1; i < routeLocations.length; i++) {
      const b = bucket(routeLocations[i].speed);
      if (b !== curBucket) {
        curPts.push(routeLocations[i].coords); // overlap for continuity
        segments.push({ points: curPts, color: speedToColor(curBucket, speedLimit) });
        curBucket = b;
        curPts = [routeLocations[i].coords];
      } else {
        curPts.push(routeLocations[i].coords);
      }
    }
    if (curPts.length > 1) {
      segments.push({ points: curPts, color: speedToColor(curBucket, speedLimit) });
    }
    return segments;
  }, [routeLocations, speedLimit]);

  /** Direction arrow markers — at most 25 along the full route */
  const arrowMarkers = useMemo(() => {
    if (routeLocations.length < 4) return [];
    const step = Math.max(5, Math.floor(routeLocations.length / 25));
    const result: { coords: [number, number]; angle: number }[] = [];
    for (let i = step; i < routeLocations.length - 1; i += step) {
      result.push({
        coords: routeLocations[i].coords,
        angle: bearingDeg(routeLocations[i - 1].coords, routeLocations[i].coords),
      });
    }
    return result;
  }, [routeLocations]);

  // ---------------------------------------------------------------------------
  // Device commands
  // ---------------------------------------------------------------------------

  const handleCommand = async (type: CommandType) => {
    const device = devices.find((d) => d.id === selectedId);
    if (!device?.traccarId) return;
    if (type === "custom" && !customMessage.trim()) return;
    setCommandSending(type);
    setCommandResult(null);
    const attrs = type === "custom" ? { data: customMessage.trim() } : {};
    const result = await sendTraccarCommand(device.traccarId, type, attrs);
    setCommandResult(
      result.success
        ? { ok: true, msg: "Command sent successfully." }
        : { ok: false, msg: result.error ?? "Failed to send command." }
    );
    setCommandSending(null);
  };

  const selectedDevice = devices.find((d) => d.id === selectedId);
  const tile = TILE_LAYERS[mapType];

  const wsLabel = wsStatus === "live" ? { text: "● Live", cls: "text-success" }
    : wsStatus === "polling" ? { text: "↻ Polling", cls: "text-warning" }
    : { text: "… Connecting", cls: "text-muted" };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="map-wrapper">
      <div className="map-container">
        {/* ── Sidebar ── */}
        <div className="sidebar">
          <div className="sidebar-header">
            <span className="fw-bold d-flex align-items-center gap-2">
              Fleet
              {speedingCount > 0 && (
                <span className="badge bg-danger" style={{ fontSize: 10, fontWeight: 700 }}>
                  ⚠ {speedingCount} speeding
                </span>
              )}
            </span>
            <span className={`ws-badge ${wsLabel.cls}`}>{wsLabel.text}</span>
          </div>

          <div className="sidebar-body">
            {initialLoading ? (
              <div className="text-center py-4" style={{ color: "#64748b" }}>
                <div className="spinner-border spinner-border-sm mb-2" />
                <p className="mb-0" style={{ fontSize: 12 }}>Loading fleet…</p>
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-4" style={{ color: "#64748b" }}>
                <p className="mb-1">No devices</p>
                <button
                  className="btn btn-sm btn-outline-light mt-2"
                  onClick={() => navigate("/admin")}
                >
                  + Add Device
                </button>
              </div>
            ) : (
              devices.map((device) => {
                const speeding = isSpeeding(device);
                return (
                  <div
                    key={device.id}
                    className={`device-card${device.id === selectedId ? " selected" : ""}${speeding ? " speeding" : ""}`}
                    onClick={() => {
                      setSelectedId(device.id);
                      setShouldFly(true);
                    }}
                  >
                    <div className="d-flex align-items-center mb-1">
                      <span className={`status-dot ${device.status}`} />
                      <span className="device-name">{device.name}</span>
                    </div>
                    {device.speed !== undefined && (
                      <div className={`device-speed${speeding ? " speeding" : ""}`}>
                        {device.speed.toFixed(0)} km/h
                        {speeding && <span className="ms-1">⚠</span>}
                      </div>
                    )}
                    {addresses[device.id] && (
                      <div className="device-address">{addresses[device.id]}</div>
                    )}
                    {device.lastUpdate && (
                      <div className="device-time">
                        {format(new Date(device.lastUpdate), "HH:mm:ss")}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Map type + settings controls */}
          <div className="map-controls">
            <div className="d-flex gap-1">
              {(["street", "satellite", "dark"] as MapType[]).map((t) => (
                <button
                  key={t}
                  className={`map-type-btn ${mapType === t ? "active" : ""}`}
                  onClick={() => setMapType(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <label className="d-flex align-items-center gap-1 mt-2" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={followMode}
                onChange={(e) => setFollowMode(e.target.checked)}
              />
              <span style={{ fontSize: 12 }}>Follow selected</span>
            </label>
            <label className="d-flex align-items-center gap-1 mt-1" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showGeofences}
                onChange={(e) => setShowGeofences(e.target.checked)}
              />
              <span style={{ fontSize: 12 }}>
                Show geofences{geofences.length > 0 ? ` (${geofences.length})` : ""}
              </span>
            </label>
            <div className="d-flex align-items-center gap-1 mt-1">
              <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                Speed limit:
              </span>
              <input
                type="number"
                className="trip-input"
                style={{ width: 56, padding: "2px 6px" }}
                min={30}
                max={300}
                value={speedLimit}
                onChange={(e) => setSpeedLimit(Number(e.target.value))}
              />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>km/h</span>
            </div>
          </div>

          {/* Device commands — single button opens modal */}
          {isTraccarConfigured() && selectedDevice?.traccarId && (
            <div className="trip-panel">
              <button
                className="trip-btn w-100"
                onClick={() => { setCommandResult(null); setShowCommandsModal(true); }}
              >
                ⚡ Device Commands
              </button>
            </div>
          )}

          {/* Trip history */}
          <div className="trip-panel">
            <div className="fw-semibold mb-2" style={{ fontSize: 13 }}>Trip History</div>
            {!isTraccarConfigured() ? (
              <p style={{ fontSize: 12, color: "#64748b" }}>Connect Traccar to load routes.</p>
            ) : (
              <form onSubmit={handleTripHistory}>
                <div className="mb-1">
                  <label className="trip-label">Start</label>
                  <input
                    type="datetime-local"
                    className="trip-input"
                    value={tripStart}
                    onChange={(e) => setTripStart(e.target.value)}
                  />
                </div>
                <div className="mb-2">
                  <label className="trip-label">End</label>
                  <input
                    type="datetime-local"
                    className="trip-input"
                    value={tripEnd}
                    onChange={(e) => setTripEnd(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="trip-btn"
                  disabled={tripLoading || !selectedId}
                >
                  {tripLoading ? "Loading…" : "Load Route"}
                </button>
              </form>
            )}

            {tripError && (
              <div className="trip-error">{tripError}</div>
            )}

            {routeSummary && (
              <div className="trip-summary">
                <div>{routeSummary.distance.toFixed(2)} km</div>
                {routeSummary.maxSpeed !== undefined && (
                  <div>Max {routeSummary.maxSpeed.toFixed(0)} km/h</div>
                )}
                {routeSummary.start && (
                  <div>{format(routeSummary.start, "HH:mm")} → {format(routeSummary.end!, "HH:mm")}</div>
                )}
              </div>
            )}

            {/* Playback controls */}
            {routeLocations.length > 0 && (
              <div className="playback-controls">
                <div className="d-flex gap-1 mb-1">
                  <button className="trip-btn flex-fill" onClick={isPlaying ? stopPlayback : startPlayback}>
                    {isPlaying ? "⏸ Pause" : "▶ Play"}
                  </button>
                  <button className="trip-btn" onClick={() => { stopPlayback(); setPlayheadIdx(0); }}>
                    ↺
                  </button>
                </div>
                <select
                  className="trip-input"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                >
                  <option value={1}>1× speed</option>
                  <option value={5}>5× speed</option>
                  <option value={10}>10× speed</option>
                  <option value={50}>50× speed</option>
                </select>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  Point {playheadIdx + 1} / {routeLocations.length}
                  {routeLocations[playheadIdx] && (
                    <span> · {routeLocations[playheadIdx].speed.toFixed(0)} km/h</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Map ── */}
        <div className="map-area">
          <MapContainer
            center={
              devices.length > 0
                ? (selectedDevice?.coords ?? devices[0].coords)
                : [30.3753, 69.3451]
            }
            zoom={devices.length > 0 ? 14 : 6}
            className="map"
          >
            <TileLayer attribution={tile.attribution} url={tile.url} />

            {/* Geofence circles */}
            {showGeofences &&
              geofences.map((g, i) => {
                const parsed = parseCircleWKT(g.area);
                if (!parsed) return null;
                const color = GEOFENCE_COLORS[i % GEOFENCE_COLORS.length];
                return (
                  <Circle
                    key={g.id}
                    center={[parsed.lat, parsed.lng]}
                    radius={parsed.radius}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}
                  >
                    <Popup>
                      <strong>{g.name}</strong>
                      {g.description && <><br /><small>{g.description}</small></>}
                      <br />
                      <small className="text-muted">r = {parsed.radius.toLocaleString()} m</small>
                    </Popup>
                  </Circle>
                );
              })}

            {/* Route: speed-coloured segments + direction arrows */}
            {speedSegments.length > 0 && (
              <>
                {speedSegments.map((seg, i) => (
                  <Polyline
                    key={i}
                    positions={seg.points}
                    pathOptions={{ color: seg.color, weight: 5, opacity: 0.92 }}
                  />
                ))}
                {arrowMarkers.map((a, i) => (
                  <Marker key={`arr-${i}`} position={a.coords} icon={makeArrowIcon(a.angle)} />
                ))}
                <CircleMarker
                  center={routeLocations[0].coords}
                  radius={9}
                  pathOptions={{ color: "#16a34a", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }}
                />
                <CircleMarker
                  center={routeLocations[routeLocations.length - 1].coords}
                  radius={9}
                  pathOptions={{ color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 1, weight: 2 }}
                />
                {routeLocations[playheadIdx] && (
                  <Marker
                    position={routeLocations[playheadIdx].coords}
                    icon={playheadIcon}
                  />
                )}
              </>
            )}

            {/* Device markers */}
            <MarkerClusterGroup chunkedLoading>
              {devices.map((device) => (
                <Marker
                  key={device.id}
                  position={device.coords}
                  icon={makeIcon(device.id === selectedId, isSpeeding(device))}
                  rotationAngle={device.angle}
                  rotationOrigin="center"
                  ref={(ref: any) => {
                    if (ref) {
                      markerRefs.current[device.id] = ref;
                      if (ref.setRotationAngle) ref.setRotationAngle(device.angle ?? 0);
                    }
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedId(device.id);
                      setShouldFly(true);
                    },
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <div className="fw-bold mb-1">{device.name}</div>
                      <div className="text-muted small mb-1">
                        {addresses[device.id] ?? `${device.coords[0].toFixed(5)}, ${device.coords[1].toFixed(5)}`}
                      </div>
                      <div className="d-flex gap-2 flex-wrap">
                        {device.speed !== undefined && (
                          <span className={`badge ${isSpeeding(device) ? "bg-danger" : "bg-primary"}`}>
                            {device.speed.toFixed(0)} km/h
                          </span>
                        )}
                        {device.battery !== undefined && (
                          <span className="badge bg-secondary">{device.battery}% batt</span>
                        )}
                        <span className={`badge bg-${device.status === "online" ? "success" : "danger"}`}>
                          {device.status}
                        </span>
                      </div>
                      {device.lastUpdate && (
                        <div className="text-muted small mt-1">
                          {format(new Date(device.lastUpdate), "MMM d, HH:mm:ss")}
                        </div>
                      )}
                      <div className="text-muted small">IMEI: {device.imei}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>

            {/* Fly-to triggers */}
            {selectedDevice && shouldFly && (
              <MapFlyTo coords={selectedDevice.coords} />
            )}
            {selectedDevice && followMode && (
              <MapFlyTo
                key={`follow-${selectedDevice.coords[0]}-${selectedDevice.coords[1]}`}
                coords={selectedDevice.coords}
                zoom={16}
              />
            )}
            {routeCenter && routeLocations.length > 0 && (
              <MapFlyTo
                key={`route-${routeCenter[0]}-${routeCenter[1]}`}
                coords={routeCenter}
                zoom={13}
              />
            )}
          </MapContainer>
          {!isTraccarConfigured() && (
            <div className="map-offline-overlay">
              <div className="map-offline-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  strokeLinejoin="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              </div>
              <div className="map-offline-title">Connect Traccar to see live devices</div>
              <button
                className="btn btn-primary btn-sm mt-2"
                onClick={() => navigate("/traccar")}
              >
                Connect →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: bottom tab bar ─────────────────────── */}
      <div className="mobile-map-bar">
        <button
          className={`mobile-tab${mobileTab === "vehicles" ? " active" : ""}`}
          onClick={() => setMobileTab((t) => (t === "vehicles" ? null : "vehicles"))}
        >
          🚗 Fleet ({devices.length})
        </button>
        <button
          className={`mobile-tab${mobileTab === "trip" ? " active" : ""}`}
          onClick={() => setMobileTab((t) => (t === "trip" ? null : "trip"))}
        >
          📍 Trip
        </button>
        {isTraccarConfigured() && selectedDevice?.traccarId && (
          <button
            className={`mobile-tab${mobileTab === "commands" ? " active" : ""}`}
            onClick={() => setMobileTab((t) => (t === "commands" ? null : "commands"))}
          >
            ⚡ Commands
          </button>
        )}
      </div>

      {/* ── Mobile: slide-up sheet ──────────────────────── */}
      {mobileTab && (
        <div className="mobile-sheet">
          <div className="mobile-sheet-handle" onClick={() => setMobileTab(null)} />
          <div className="mobile-sheet-body">

            {/* Fleet list */}
            {mobileTab === "vehicles" && (
              <div>
                {devices.length === 0 ? (
                  <p style={{ color: "#7a93b4", fontSize: 13 }}>No devices found.</p>
                ) : (
                  devices.map((device) => {
                    const sp = isSpeeding(device);
                    return (
                      <div
                        key={device.id}
                        className={`device-card${device.id === selectedId ? " selected" : ""}${sp ? " speeding" : ""}`}
                        onClick={() => {
                          setSelectedId(device.id);
                          setShouldFly(true);
                          setMobileTab(null);
                        }}
                      >
                        <div className="d-flex align-items-center mb-1">
                          <span className={`status-dot ${device.status}`} />
                          <span className="device-name">{device.name}</span>
                        </div>
                        {device.speed !== undefined && (
                          <div className={`device-speed${sp ? " speeding" : ""}`}>
                            {device.speed.toFixed(0)} km/h{sp && " ⚠"}
                          </div>
                        )}
                        {addresses[device.id] && (
                          <div className="device-address">{addresses[device.id]}</div>
                        )}
                        {device.lastUpdate && (
                          <div className="device-time">
                            {format(new Date(device.lastUpdate), "HH:mm:ss")}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Trip */}
            {mobileTab === "trip" && (
              <div>
                <div className="mb-3">
                  <label className="trip-label">Speed Limit (km/h)</label>
                  <input
                    type="number"
                    className="trip-input"
                    min={30} max={300}
                    value={speedLimit}
                    onChange={(e) => setSpeedLimit(Number(e.target.value))}
                  />
                </div>
                {!isTraccarConfigured() ? (
                  <p style={{ fontSize: 12, color: "#64748b" }}>Connect Traccar to load routes.</p>
                ) : (
                  <form onSubmit={handleTripHistory}>
                    <div className="mb-2">
                      <label className="trip-label">Start</label>
                      <input type="datetime-local" className="trip-input" value={tripStart}
                        onChange={(e) => setTripStart(e.target.value)} />
                    </div>
                    <div className="mb-2">
                      <label className="trip-label">End</label>
                      <input type="datetime-local" className="trip-input" value={tripEnd}
                        onChange={(e) => setTripEnd(e.target.value)} />
                    </div>
                    <button type="submit" className="trip-btn" disabled={tripLoading || !selectedId}>
                      {tripLoading ? "Loading…" : "Load Route"}
                    </button>
                  </form>
                )}
                {tripError && <div className="trip-error">{tripError}</div>}
                {routeSummary && (
                  <div className="trip-summary">
                    <div>{routeSummary.distance.toFixed(2)} km</div>
                    {routeSummary.maxSpeed !== undefined && (
                      <div>Max {routeSummary.maxSpeed.toFixed(0)} km/h</div>
                    )}
                  </div>
                )}
                {routeLocations.length > 0 && (
                  <div className="playback-controls mt-2">
                    <div className="d-flex gap-1 mb-1">
                      <button className="trip-btn flex-fill" onClick={isPlaying ? stopPlayback : startPlayback}>
                        {isPlaying ? "⏸ Pause" : "▶ Play"}
                      </button>
                      <button className="trip-btn" style={{ width: 36 }}
                        onClick={() => { stopPlayback(); setPlayheadIdx(0); }}>↺</button>
                    </div>
                    <select className="trip-input" value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(Number(e.target.value))}>
                      <option value={1}>1× speed</option>
                      <option value={5}>5× speed</option>
                      <option value={10}>10× speed</option>
                      <option value={50}>50× speed</option>
                    </select>
                    <div style={{ fontSize: 11, color: "#3d5470", marginTop: 4 }}>
                      Point {playheadIdx + 1} / {routeLocations.length}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Commands */}
            {mobileTab === "commands" && selectedDevice && (
              <div>
                {commandResult && (
                  <div className={`trip-${commandResult.ok ? "summary" : "error"} mb-2`}
                    style={{ color: commandResult.ok ? "#4ade80" : "#f87171" }}>
                    {commandResult.ok ? "✓ " : "✗ "}{commandResult.msg}
                  </div>
                )}
                {[
                  { type: "engineStop" as CommandType, icon: "🔴", label: "Engine Stop (Immobilize)" },
                  { type: "engineResume" as CommandType, icon: "🟢", label: "Engine Resume" },
                  { type: "positionSingle" as CommandType, icon: "📍", label: "Request Position" },
                  { type: "alarm" as CommandType, icon: "🚨", label: "Trigger Alarm" },
                  { type: "deviceReboot" as CommandType, icon: "🔄", label: "Reboot Device" },
                ].map((cmd) => (
                  <button
                    key={cmd.type}
                    className="trip-btn mb-1 d-flex align-items-center gap-2"
                    style={{ justifyContent: "flex-start", padding: "8px 12px", textAlign: "left" }}
                    disabled={commandSending !== null}
                    onClick={() => handleCommand(cmd.type)}
                  >
                    <span>{cmd.icon}</span>
                    <span style={{ flex: 1 }}>{cmd.label}</span>
                    {commandSending === cmd.type && (
                      <span className="spinner-border spinner-border-sm" />
                    )}
                  </button>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Commands modal ── */}
      {showCommandsModal && selectedDevice && (
        <>
          <div
            className="modal fade show"
            style={{ display: "block" }}
            tabIndex={-1}
            onClick={(e) => { if (e.target === e.currentTarget) setShowCommandsModal(false); }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    ⚡ Commands — <span className="text-primary">{selectedDevice.name}</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowCommandsModal(false)}
                  />
                </div>

                <div className="modal-body">
                  {commandResult && (
                    <div className={`alert alert-${commandResult.ok ? "success" : "danger"} py-2 mb-3`}>
                      {commandResult.ok ? "✓ " : "✗ "}{commandResult.msg}
                    </div>
                  )}

                  <p className="text-muted small mb-3">
                    Commands are sent via Traccar to the device over GPRS. The device must be online
                    and support the command type.
                  </p>

                  <div className="list-group">
                    {(
                      [
                        {
                          type: "engineStop" as CommandType,
                          icon: "🔴",
                          label: "Engine Stop (Immobilize)",
                          desc: "Activates the immobilizer relay — cuts engine output. Use with caution.",
                        },
                        {
                          type: "engineResume" as CommandType,
                          icon: "🟢",
                          label: "Engine Resume",
                          desc: "Deactivates the immobilizer — restores engine control.",
                        },
                        {
                          type: "positionSingle" as CommandType,
                          icon: "📍",
                          label: "Request Position",
                          desc: "Ask the device to send its current GPS position immediately.",
                        },
                        {
                          type: "alarm" as CommandType,
                          icon: "🚨",
                          label: "Trigger Alarm",
                          desc: "Send an alarm signal to the device (buzzer / LED depending on model).",
                        },
                        {
                          type: "deviceReboot" as CommandType,
                          icon: "🔄",
                          label: "Reboot Device",
                          desc: "Restart the tracker firmware. It will reconnect within ~30 seconds.",
                        },
                      ] as { type: CommandType; icon: string; label: string; desc: string }[]
                    ).map((cmd) => (
                      <button
                        key={cmd.type}
                        className="list-group-item list-group-item-action d-flex align-items-start gap-3 py-3"
                        disabled={commandSending !== null}
                        onClick={() => handleCommand(cmd.type)}
                      >
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{cmd.icon}</span>
                        <div className="text-start">
                          <div className="fw-semibold">{cmd.label}</div>
                          <div className="text-muted small">{cmd.desc}</div>
                        </div>
                        {commandSending === cmd.type && (
                          <span className="spinner-border spinner-border-sm ms-auto mt-1 flex-shrink-0" />
                        )}
                      </button>
                    ))}

                    {/* Custom message row */}
                    <div className="list-group-item py-3">
                      <div className="d-flex align-items-start gap-3">
                        <span style={{ fontSize: 20, lineHeight: 1 }}>✉️</span>
                        <div className="flex-fill text-start">
                          <div className="fw-semibold">Custom Message</div>
                          <div className="text-muted small mb-2">
                            Send a raw GPRS/SMS command string to the device.
                          </div>
                          <div className="input-group input-group-sm">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g. setparam 2000:1"
                              value={customMessage}
                              onChange={(e) => setCustomMessage(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && customMessage.trim()) handleCommand("custom");
                              }}
                            />
                            <button
                              className="btn btn-outline-secondary"
                              disabled={commandSending !== null || !customMessage.trim()}
                              onClick={() => handleCommand("custom")}
                            >
                              {commandSending === "custom"
                                ? <span className="spinner-border spinner-border-sm" />
                                : "Send"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowCommandsModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </div>
  );
};

export default MapView;
