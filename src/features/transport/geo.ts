/**
 * Transport Management System — Geo Utilities
 *
 * Haversine-based straight-line distance calculation.
 * Zero cost, runs client-side in < 0.01 ms.
 */

const EARTH_RADIUS_KM = 6371;

/** Degrees → radians */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the straight-line (great-circle) distance between two
 * coordinates using the Haversine formula.
 *
 * @returns distance in kilometres
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Human-readable distance string.
 *
 * - Under 1 km → "850 m"
 * - 1 km and above → "2.3 km"
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
