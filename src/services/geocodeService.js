// src/services/geocodeService.js
/**
 * Keyless geocoding for Bengaluru via the public OpenStreetMap Nominatim service.
 * Replaces hardcoded locality coordinate dictionaries with live public-data lookups.
 *
 * Fair-use compliance (https://operations.osmfoundation.org/policies/nominatim/):
 *  - Browser sends a valid Referer automatically; we never spoof a User-Agent
 *    (browser fetch cannot set one).
 *  - Requests are serialized to <= 1 request/second with a module-level gate.
 *  - Results are memoized per query and the bounding box is capped to Bengaluru.
 *  - No bulk geocoding: only single user-initiated searches/typeahead.
 * See DATA_SOURCES.md → "Nominatim" for the documented contract.
 */

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

// Bengaluru metropolitan bounding box as "west,south,east,north".
const BENGALURU_VIEWBOX = "77.30,12.70,77.88,13.28";

// Nominatim public policy: no more than 1 request per second per client.
const MIN_REQUEST_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 6000;

let lastRequestAt = 0;
const resultCache = new Map();

const isInsideBengaluruViewbox = (lat, lng) =>
  lat >= 12.7 && lat <= 13.28 && lng >= 77.3 && lng <= 77.88;

const fetchNominatim = async (params) => {
  const waitMs = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestAt = Date.now();

  const url = `${NOMINATIM_SEARCH_URL}?format=jsonv2&countrycodes=in&viewbox=${BENGALURU_VIEWBOX}&bounded=1&${params}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Nominatim request failed (HTTP ${res.status}).`);
  }
  return res.json();
};

/**
 * Resolve a free-text Bengaluru landmark/area to live coordinates.
 * Returns `{ lat, lng, label, type }` or `null` when nothing matches inside Bengaluru.
 */
export const geocodeBengaluruPlace = async (query) => {
  const trimmed = String(query || "").trim();
  if (trimmed.length < 2) return null;

  const cacheKey = trimmed.toLowerCase();
  if (resultCache.has(cacheKey)) {
    return resultCache.get(cacheKey);
  }

  let results;
  try {
    results = await fetchNominatim(`addressdetails=1&limit=5&q=${encodeURIComponent(trimmed)}`);
  } catch (err) {
    console.warn("[geocode] Nominatim lookup failed:", err.message);
    return null;
  }

  if (!Array.isArray(results) || results.length === 0) return null;

  const first = results[0];
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInsideBengaluruViewbox(lat, lng)) {
    return null;
  }

  const place = {
    lat,
    lng,
    label: first.display_name || trimmed,
    type: first.type || "place",
  };
  resultCache.set(cacheKey, place);
  return place;
};

/**
 * Live typeahead suggestions for place inputs (Safe Route modal).
 * Never throws: returns `[]` when the service is unreachable or nothing matches.
 */
export const suggestBengaluruPlaces = async (query) => {
  const trimmed = String(query || "").trim();
  if (trimmed.length < 2) return [];

  try {
    const results = await fetchNominatim(`addressdetails=0&limit=5&q=${encodeURIComponent(trimmed)}`);
    if (!Array.isArray(results)) return [];
    return results
      .map((r) => {
        const lat = Number(r.lat);
        const lng = Number(r.lon);
        const label = r.display_name || "";
        return {
          lat,
          lng,
          label,
          shortLabel: label.split(", ").slice(0, 2).join(", "),
          type: r.type || "place",
        };
      })
      .filter(
        (p) =>
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng) &&
          isInsideBengaluruViewbox(p.lat, p.lng)
      );
  } catch (err) {
    console.warn("[geocode] Nominatim typeahead failed:", err.message);
    return [];
  }
};
