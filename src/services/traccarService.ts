/**
 * Traccar Integration Service
 *
 * All REST requests go through the Vite dev proxy at /traccar → VITE_TRACCAR_URL
 * using HTTP Basic auth.
 *
 * WebSocket (/api/socket) requires a cookie session (JSESSIONID), not Basic auth.
 * Call establishCookieSession() before opening the WebSocket.
 *
 * Speed unit: Traccar returns speeds in KNOTS. Multiply by 1.852 for km/h.
 */

import type { Device } from "../types/device";
import type { LocationPoint } from "../types/trip";
import type { TraccarTripReport, TraccarSummaryReport, TraccarEvent } from "../types/event";
import type { TraccarGeofence, GeofenceFormData } from "../types/geofence";
import type { TraccarUser, TraccarGroup, PermissionLink } from "../types/user";

// ---------------------------------------------------------------------------
// Config & interfaces
// ---------------------------------------------------------------------------

export interface TraccarConfig {
  serverUrl: string; // for display only — actual calls go via /traccar proxy
  email: string;
  password: string;
}

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string; // IMEI
  status: string;
  lastUpdate?: string;
  positionId?: number;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;   // KNOTS — multiply by 1.852 for km/h
  course: number;  // heading angle in degrees
  fixTime: string; // ISO
  batteryLevel?: number;
  rssi?: number;
  attributes?: {
    batteryLevel?: number;
    rssi?: number;
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let traccarConfig: TraccarConfig | null = null;

// ---------------------------------------------------------------------------
// Core fetch helper — routes through /traccar proxy with Basic auth
// ---------------------------------------------------------------------------

const traccarFetch = (path: string, options: RequestInit = {}): Promise<Response> => {
  if (!traccarConfig) throw new Error("Traccar not configured");
  const encoded = btoa(`${traccarConfig.email}:${traccarConfig.password}`);
  return fetch(`/traccar/api/${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${encoded}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
};

// ---------------------------------------------------------------------------
// Auth — Basic auth for REST, Cookie session for WebSocket
// ---------------------------------------------------------------------------

export const initializeTraccar = async (config: TraccarConfig): Promise<boolean> => {
  try {
    traccarConfig = config;
    const response = await traccarFetch("devices");
    if (!response.ok) {
      traccarConfig = null;
      return false;
    }
    localStorage.setItem("traccar_config", JSON.stringify(config));
    const user = await getCurrentTraccarUser();
    if (user) {
      const role = user.admin ? "admin" : (user.attributes.trackme_role ?? null);
      if (role) localStorage.setItem("trackme_current_role", role as string);
    }
    // Pre-establish cookie session so WebSocket is ready immediately
    await establishCookieSession();
    return true;
  } catch (error) {
    console.error("Error initializing Traccar:", error);
    traccarConfig = null;
    return false;
  }
};

/**
 * Establish a JSESSIONID cookie session via POST /api/session.
 * Required for WebSocket authentication — the WS endpoint uses cookies, not Basic auth.
 * The Vite proxy rewrites the Set-Cookie domain to localhost via cookieDomainRewrite.
 */
export const establishCookieSession = async (): Promise<boolean> => {
  if (!traccarConfig) return false;
  try {
    const res = await fetch("/traccar/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      credentials: "include",
      body: new URLSearchParams({
        email: traccarConfig.email,
        password: traccarConfig.password,
      }).toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const loadTraccarConfig = (): TraccarConfig | null => {
  try {
    const stored = localStorage.getItem("traccar_config");
    if (stored) {
      const config = JSON.parse(stored) as TraccarConfig;
      traccarConfig = config;
      return config;
    }
  } catch {
    // ignore
  }
  return null;
};

export const isTraccarConfigured = (): boolean => {
  if (traccarConfig) return true;
  return loadTraccarConfig() !== null;
};

export const getCurrentTraccarUser = async (): Promise<TraccarUser | null> => {
  try {
    const res = await traccarFetch("session");
    if (!res.ok) return null;
    return res.json() as Promise<TraccarUser>;
  } catch {
    return null;
  }
};

export const restoreTraccarSession = async (): Promise<boolean> => {
  const config = loadTraccarConfig();
  if (!config) return false;
  traccarConfig = config;
  try {
    const response = await traccarFetch("devices");
    if (!response.ok) {
      traccarConfig = null;
      return false;
    }
    await establishCookieSession();
    return true;
  } catch {
    traccarConfig = null;
    return false;
  }
};

export const disconnectTraccar = (): void => {
  traccarConfig = null;
  localStorage.removeItem("traccar_config");
  localStorage.removeItem("traccar_token");
  localStorage.removeItem("trackme_current_role");
};

// ---------------------------------------------------------------------------
// Device queries
// ---------------------------------------------------------------------------

export const getTraccarDevices = async (): Promise<TraccarDevice[]> => {
  try {
    const response = await traccarFetch("devices");
    if (!response.ok) throw new Error(response.statusText);
    return await response.json();
  } catch (error) {
    console.error("Error fetching Traccar devices:", error);
    return [];
  }
};

export const getTraccarPositions = async (deviceId?: number): Promise<TraccarPosition[]> => {
  try {
    const path = deviceId ? `positions?deviceId=${deviceId}` : "positions";
    const response = await traccarFetch(path);
    if (!response.ok) throw new Error(response.statusText);
    return await response.json();
  } catch (error) {
    console.error("Error fetching Traccar positions:", error);
    return [];
  }
};

export const getTraccarLatestPosition = async (
  deviceId: number
): Promise<TraccarPosition | null> => {
  try {
    const response = await traccarFetch(`positions?deviceId=${deviceId}`);
    if (!response.ok) throw new Error(response.statusText);
    const positions: TraccarPosition[] = await response.json();
    return positions.length > 0 ? positions[0] : null;
  } catch (error) {
    console.error("Error fetching Traccar position:", error);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Device sync — Traccar → local Device format
// ---------------------------------------------------------------------------

export const syncTraccarDevices = async (): Promise<Device[]> => {
  try {
    const [traccarDevices, positions] = await Promise.all([
      getTraccarDevices(),
      getTraccarPositions(),
    ]);

    const positionMap = new Map<number, TraccarPosition>();
    for (const pos of positions) {
      const existing = positionMap.get(pos.deviceId);
      if (!existing || new Date(pos.fixTime) > new Date(existing.fixTime)) {
        positionMap.set(pos.deviceId, pos);
      }
    }

    return traccarDevices.map((td) => {
      const position = positionMap.get(td.id);
      const status =
        td.status === "online" ? "online" : td.status === "offline" ? "offline" : "unknown";

      return {
        id: td.id.toString(),
        name: td.name,
        imei: td.uniqueId,
        model: "Other" as const,
        traccarId: td.id,
        status,
        lastUpdate: position ? new Date(position.fixTime) : undefined,
        coords: position
          ? ([position.latitude, position.longitude] as [number, number])
          : ([0, 0] as [number, number]),
        prevCoords: position
          ? ([position.latitude, position.longitude] as [number, number])
          : ([0, 0] as [number, number]),
        angle: position ? position.course : 0,
        speed: position ? position.speed * 1.852 : undefined, // knots → km/h
        battery: position?.attributes?.batteryLevel ?? position?.batteryLevel,
        signal: position?.attributes?.rssi ?? position?.rssi,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  } catch (error) {
    console.error("Error syncing Traccar devices:", error);
    return [];
  }
};

// ---------------------------------------------------------------------------
// Device CRUD on Traccar server
// ---------------------------------------------------------------------------

export const createTraccarDevice = async (
  name: string,
  imei: string
): Promise<TraccarDevice | null> => {
  try {
    const response = await traccarFetch("devices", {
      method: "POST",
      body: JSON.stringify({ name, uniqueId: imei }),
    });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  } catch (error) {
    console.error("Error creating Traccar device:", error);
    return null;
  }
};

export const updateTraccarDevice = async (
  traccarId: number,
  name: string,
  imei: string
): Promise<boolean> => {
  try {
    const getRes = await traccarFetch(`devices/${traccarId}`);
    if (!getRes.ok) return false;
    const existing = await getRes.json();
    const putRes = await traccarFetch(`devices/${traccarId}`, {
      method: "PUT",
      body: JSON.stringify({ ...existing, name, uniqueId: imei }),
    });
    return putRes.ok;
  } catch (error) {
    console.error("Error updating Traccar device:", error);
    return false;
  }
};

export const deleteTraccarDevice = async (traccarId: number): Promise<boolean> => {
  try {
    const response = await traccarFetch(`devices/${traccarId}`, { method: "DELETE" });
    return response.ok;
  } catch (error) {
    console.error("Error deleting Traccar device:", error);
    return false;
  }
};

// ---------------------------------------------------------------------------
// Location history (route replay)
// ---------------------------------------------------------------------------

export const getTraccarLocationHistory = async (
  deviceId: number,
  from: Date,
  to: Date
): Promise<LocationPoint[]> => {
  try {
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    const response = await traccarFetch(
      `reports/route?deviceId=${deviceId}&from=${fromISO}&to=${toISO}`
    );
    if (!response.ok) throw new Error(response.statusText);
    const positions: TraccarPosition[] = await response.json();

    return positions.map((pos) => ({
      timestamp: new Date(pos.fixTime),
      coords: [pos.latitude, pos.longitude] as [number, number],
      speed: pos.speed * 1.852, // knots → km/h
      angle: pos.course,
      battery: pos.attributes?.batteryLevel ?? pos.batteryLevel,
      signal: pos.attributes?.rssi ?? pos.rssi,
    }));
  } catch (error) {
    console.error("Error fetching location history:", error);
    return [];
  }
};

// ---------------------------------------------------------------------------
// Reports API
// ---------------------------------------------------------------------------

export const getTraccarTrips = async (
  deviceId: number,
  from: Date,
  to: Date
): Promise<TraccarTripReport[]> => {
  try {
    const res = await traccarFetch(
      `reports/trips?deviceId=${deviceId}&from=${from.toISOString()}&to=${to.toISOString()}`
    );
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (error) {
    console.error("Error fetching Traccar trips:", error);
    return [];
  }
};

export const getTraccarSummary = async (
  from: Date,
  to: Date,
  deviceId?: number
): Promise<TraccarSummaryReport[]> => {
  try {
    const deviceParam = deviceId ? `&deviceId=${deviceId}` : "";
    const res = await traccarFetch(
      `reports/summary?from=${from.toISOString()}&to=${to.toISOString()}${deviceParam}`
    );
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (error) {
    console.error("Error fetching Traccar summary:", error);
    return [];
  }
};

export const getTraccarEvents = async (
  deviceId: number,
  from: Date,
  to: Date,
  types?: string[]
): Promise<TraccarEvent[]> => {
  try {
    const typeParam = types ? types.map((t) => `&type=${t}`).join("") : "";
    const res = await traccarFetch(
      `reports/events?deviceId=${deviceId}&from=${from.toISOString()}&to=${to.toISOString()}${typeParam}`
    );
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (error) {
    console.error("Error fetching Traccar events:", error);
    return [];
  }
};

// ---------------------------------------------------------------------------
// Geofences API
// ---------------------------------------------------------------------------

export const getTraccarGeofences = async (): Promise<TraccarGeofence[]> => {
  try {
    const res = await traccarFetch("geofences");
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (error) {
    console.error("Error fetching geofences:", error);
    return [];
  }
};

export const createTraccarGeofence = async (
  data: GeofenceFormData
): Promise<TraccarGeofence | null> => {
  try {
    const res = await traccarFetch("geofences", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Error creating geofence:", error);
    return null;
  }
};

export const deleteTraccarGeofence = async (id: number): Promise<boolean> => {
  try {
    const res = await traccarFetch(`geofences/${id}`, { method: "DELETE" });
    return res.ok;
  } catch (error) {
    console.error("Error deleting geofence:", error);
    return false;
  }
};

// ---------------------------------------------------------------------------
// User CRUD
// ---------------------------------------------------------------------------

export const getTraccarUsers = async (): Promise<TraccarUser[]> => {
  const res = await traccarFetch("users");
  if (!res.ok) return [];
  return res.json() as Promise<TraccarUser[]>;
};

export const createTraccarUser = async (data: {
  name: string;
  email: string;
  password: string;
  attributes: Record<string, unknown>;
}): Promise<TraccarUser> => {
  const res = await traccarFetch("users", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create user: ${text}`);
  }
  return res.json() as Promise<TraccarUser>;
};

export const updateTraccarUser = async (
  id: number,
  data: Partial<{ name: string; email: string; password: string; attributes: Record<string, unknown> }>
): Promise<TraccarUser> => {
  const current = await traccarFetch(`users/${id}`).then((r) => r.json()) as TraccarUser;
  const res = await traccarFetch(`users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...current, ...data }),
  });
  if (!res.ok) throw new Error("Failed to update user");
  return res.json() as Promise<TraccarUser>;
};

export const deleteTraccarUser = async (id: number): Promise<void> => {
  const res = await traccarFetch(`users/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete user");
};

// ---------------------------------------------------------------------------
// Group CRUD
// ---------------------------------------------------------------------------

export const getTraccarGroups = async (): Promise<TraccarGroup[]> => {
  const res = await traccarFetch("groups");
  if (!res.ok) return [];
  return res.json() as Promise<TraccarGroup[]>;
};

export const createTraccarGroup = async (name: string): Promise<TraccarGroup> => {
  const res = await traccarFetch("groups", {
    method: "POST",
    body: JSON.stringify({ name, attributes: {} }),
  });
  if (!res.ok) throw new Error("Failed to create group");
  return res.json() as Promise<TraccarGroup>;
};

export const updateTraccarGroup = async (id: number, name: string): Promise<TraccarGroup> => {
  const res = await traccarFetch(`groups/${id}`, {
    method: "PUT",
    body: JSON.stringify({ id, name, attributes: {} }),
  });
  if (!res.ok) throw new Error("Failed to update group");
  return res.json() as Promise<TraccarGroup>;
};

export const deleteTraccarGroup = async (id: number): Promise<void> => {
  const res = await traccarFetch(`groups/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete group");
};

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const addTraccarPermission = async (link: PermissionLink): Promise<void> => {
  const res = await traccarFetch("permissions", {
    method: "POST",
    body: JSON.stringify(link),
  });
  if (!res.ok) throw new Error("Failed to add permission");
};

export const removeTraccarPermission = async (link: PermissionLink): Promise<void> => {
  const res = await traccarFetch("permissions", {
    method: "DELETE",
    body: JSON.stringify(link),
  });
  if (!res.ok) throw new Error("Failed to remove permission");
};

// ---------------------------------------------------------------------------
// WebSocket — real-time position updates
// Must call establishCookieSession() first (done in initializeTraccar / restoreTraccarSession)
// ---------------------------------------------------------------------------

export const setupTraccarWebSocket = async (
  onPosition: (deviceId: number, position: TraccarPosition) => void,
  onDeviceStatus?: (deviceId: number, status: string) => void,
  onOpen?: () => void,
  onClose?: () => void
): Promise<WebSocket | null> => {
  if (!traccarConfig) return null;

  // Ensure cookie session exists for WS handshake
  const sessionOk = await establishCookieSession();
  if (!sessionOk) {
    console.warn("Cookie session failed — WebSocket will not open, using polling");
    return null;
  }

  try {
    const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${location.host}/traccar/api/socket`);

    ws.onopen = () => {
      console.log("Traccar WebSocket connected");
      onOpen?.();
    };

    ws.onclose = () => {
      console.warn("Traccar WebSocket closed");
      onClose?.();
    };

    ws.onerror = () => {
      console.warn("Traccar WebSocket error — polling fallback active");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (Array.isArray(data.positions)) {
          for (const pos of data.positions as TraccarPosition[]) {
            onPosition(pos.deviceId, pos);
          }
        }
        if (Array.isArray(data.devices) && onDeviceStatus) {
          for (const device of data.devices as { id: number; status: string }[]) {
            onDeviceStatus(device.id, device.status);
          }
        }
      } catch {
        // ignore malformed frames
      }
    };

    return ws;
  } catch (error) {
    console.error("WebSocket setup error:", error);
    return null;
  }
};

/** Alias for backwards compatibility */
export const createTraccarWebSocket = setupTraccarWebSocket;

// ---------------------------------------------------------------------------
// Device commands (immobilizer, position request, etc.)
// ---------------------------------------------------------------------------

export type CommandType =
  | "engineStop"
  | "engineResume"
  | "positionSingle"
  | "alarm"
  | "deviceReboot"
  | "custom";

export const sendTraccarCommand = async (
  deviceId: number,
  type: CommandType,
  attributes: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> => {
  try {
    const res = await traccarFetch("commands/send", {
      method: "POST",
      body: JSON.stringify({ deviceId, type, attributes }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { success: false, error: text || res.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
};

// ---------------------------------------------------------------------------
// Geofence ↔ device permissions
// ---------------------------------------------------------------------------

/** Returns the geofence IDs currently linked to a specific device. */
export const getDeviceGeofenceIds = async (deviceId: number): Promise<number[]> => {
  try {
    const res = await traccarFetch(`geofences?deviceId=${deviceId}`);
    if (!res.ok) return [];
    const data = await res.json() as { id: number }[];
    return data.map((g) => g.id);
  } catch {
    return [];
  }
};

/** Link a geofence to a device so Traccar fires enter/exit events. */
export const linkGeofenceToDevice = async (
  deviceId: number,
  geofenceId: number
): Promise<boolean> => {
  try {
    const res = await traccarFetch("permissions", {
      method: "POST",
      body: JSON.stringify({ deviceId, geofenceId }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

/** Remove the link between a geofence and a device. */
export const unlinkGeofenceFromDevice = async (
  deviceId: number,
  geofenceId: number
): Promise<boolean> => {
  try {
    const res = await traccarFetch("permissions", {
      method: "DELETE",
      body: JSON.stringify({ deviceId, geofenceId }),
    });
    return res.ok;
  } catch {
    return false;
  }
};
