// Solar geometry helpers — NOAA approximate solar position algorithm.
// Pure functions: given lat/long and a UTC instant, return sun azimuth/altitude.

export interface SunPosition {
  /** Compass bearing of the sun, degrees clockwise from true north */
  azimuth: number;
  /** Elevation above horizon, degrees (negative = below horizon) */
  altitude: number;
}

const RAD = Math.PI / 180;

function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function sunPosition(date: Date, lat: number, long: number): SunPosition {
  const jd = julianDay(date);
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360; // mean longitude
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD; // mean anomaly
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const epsilon = (23.439 - 0.0000004 * n) * RAD;

  const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  const rightAsc = Math.atan2(
    Math.cos(epsilon) * Math.sin(lambda),
    Math.cos(lambda),
  );

  // Greenwich mean sidereal time → local hour angle
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = ((gmst * 15 + long) % 360) * RAD;
  let ha = lst - rightAsc;
  ha = Math.atan2(Math.sin(ha), Math.cos(ha));

  const phi = lat * RAD;
  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(declination) +
      Math.cos(phi) * Math.cos(declination) * Math.cos(ha),
  );
  let azimuth = Math.atan2(
    Math.sin(ha),
    Math.cos(ha) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi),
  );
  azimuth = (azimuth / RAD + 180) % 360; // from north, clockwise

  return { azimuth: (azimuth + 360) % 360, altitude: altitude / RAD };
}

/** Solar noon altitude (max sun height) for the given day. */
export function solarNoonAltitude(date: Date, lat: number, long: number): number {
  let best = -90;
  for (let m = 0; m < 24 * 60; m += 10) {
    const d = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        Math.floor(m / 60),
        m % 60,
      ),
    );
    const a = sunPosition(d, lat, long).altitude;
    if (a > best) best = a;
  }
  return best;
}

/** Sample the day's sun track (above-horizon points only). */
export function sunTrack(
  date: Date,
  lat: number,
  long: number,
  stepMinutes = 20,
): Array<SunPosition & { minutes: number }> {
  const out: Array<SunPosition & { minutes: number }> = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const d = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        Math.floor(m / 60),
        m % 60,
      ),
    );
    const p = sunPosition(d, lat, long);
    if (p.altitude > 0) out.push({ ...p, minutes: m });
  }
  return out;
}

export const ORIENTATION_BEARING: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

/** Cosine of incidence between sun azimuth and a facade's outward bearing. */
export function facadeExposure(bearing: number, sunAzimuth: number, altitude: number) {
  if (altitude <= 0) return 0;
  const delta = Math.cos((bearing - sunAzimuth) * RAD);
  return Math.max(0, delta) * Math.cos(altitude * RAD);
}
