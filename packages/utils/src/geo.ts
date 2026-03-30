const EARTH_RADIUS_KM = 6371;

/** Haversine distance between two coordinates in kilometers */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Calculate movement speed in degrees per tick based on army type */
export function movementSpeedPerTick(armyType: string): number {
  const speeds: Record<string, number> = {
    infantry: 0.5,      // ~50km per tick
    armored: 1.0,       // ~100km per tick
    naval: 1.5,         // ~150km per tick
    airforce: 5.0,      // ~500km per tick
    special_ops: 2.0,   // ~200km per tick
  };
  return speeds[armyType] ?? 0.5;
}

/** Check if point is within radius of another point */
export function isWithinRadius(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  radiusKm: number
): boolean {
  return haversineDistance(lat1, lng1, lat2, lng2) <= radiusKm;
}

/** Linear interpolation between two points */
export function lerpCoords(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  t: number // 0-1
): { latitude: number; longitude: number } {
  return {
    latitude: fromLat + (toLat - fromLat) * t,
    longitude: fromLng + (toLng - fromLng) * t,
  };
}
