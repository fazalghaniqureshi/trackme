/**
 * Reverse geocoding via OpenStreetMap Nominatim.
 * Free, no API key required. Rate limit: 1 req/s.
 * Cache keyed at 4 decimal places (~11 m grid) to avoid hammering the API.
 */

const cache = new Map<string, string>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestTime = Date.now();
}

/**
 * Reverse geocode a single coordinate pair.
 * Returns a short readable address, falling back to "lat, lon" on failure.
 */
export const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
  const key = cacheKey(lat, lon);
  if (cache.has(key)) return cache.get(key)!;

  await rateLimit();

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=18`,
      { headers: { "Accept-Language": "en", "User-Agent": "TrackMe Fleet App/1.0" } }
    );
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();

    // Build a concise address from components
    const addr = data.address ?? {};
    const road = addr.road ?? addr.pedestrian ?? addr.footway ?? addr.path ?? "";
    const area = addr.suburb ?? addr.neighbourhood ?? addr.city_district ?? "";
    const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? "";
    const parts = [road, area, city].filter(Boolean);
    const result = parts.length > 0 ? parts.join(", ") : (data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`);

    cache.set(key, result);
    return result;
  } catch {
    const fallback = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    cache.set(key, fallback);
    return fallback;
  }
};

export const clearGeocodeCache = (): void => cache.clear();
