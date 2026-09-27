// server/services/spatialHex.js
/**
 * Hexagonal Spatial Indexing Engine
 * Maps geographic coordinates (lat, lng) to discrete hexagonal cells (resolution 8 ~460m)
 * with neighbor cell computation for localized spatial subscriptions.
 */

// Step sizes for Resolution 8 hex cell (~460m)
const STEP_LAT = 0.00415;
const STEP_LNG = 0.00415;

/**
 * Computes deterministic hexagonal index for geographic coordinates.
 * Uses axial coordinates (q, r) mapped to hexagonal grid.
 */
function getHexIndex(lat, lng, resolution = 8) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
    return 'hex_r8_0_0';
  }

  const q = Math.round((Math.sqrt(3) / 3 * (nLng * 100) - (1 / 3) * (nLat * 100)) / (STEP_LNG * 100));
  const r = Math.round(((2 / 3) * (nLat * 100)) / (STEP_LAT * 100));
  return `hex_r${resolution}_${q}_${r}`;
}

/**
 * Returns the hex cell along with its 6 immediate neighboring hexagonal rings.
 */
function getHexRing(hexId) {
  if (!hexId || typeof hexId !== 'string') return [hexId];
  const parts = hexId.split('_');
  if (parts.length !== 4) return [hexId];

  const res = parts[1];
  const q = parseInt(parts[2], 10);
  const r = parseInt(parts[3], 10);

  const directions = [
    [1, 0], [1, -1], [0, -1],
    [-1, 0], [-1, 1], [0, 1]
  ];

  const neighbors = directions.map(([dq, dr]) => `hex_${res}_${q + dq}_${r + dr}`);
  return [hexId, ...neighbors];
}

module.exports = {
  getHexIndex,
  getHexRing,
};
