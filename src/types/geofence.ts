export interface TraccarGeofence {
  id: number;
  name: string;
  description?: string;
  area: string; // WKT — e.g. "CIRCLE (lat lon, radius)" or "POLYGON ((lon lat, ...))"
  calendarId?: number;
  attributes?: Record<string, unknown>;
}

export interface GeofenceFormData {
  name: string;
  description?: string;
  area: string; // WKT produced from Leaflet layer
}
