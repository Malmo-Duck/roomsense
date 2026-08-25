// Client-safe types + helpers for the PVGIS per-facade solar feed.
//
// PVGIS aspect convention: 0 = south, -90 = east, +90 = west, ±180 = north.
// Compass bearings are 0 = north, 90 = east. Convert with compassToAspect().

import type { Orientation } from "./types";

export interface FacadeSolar {
  /** Compass bearing of the facade's outward normal, degrees (0 = N). */
  bearingDeg: number;
  /** PVGIS aspect actually requested (0 = south). */
  aspectDeg: number;
  /** Plane-of-array irradiation per month, kWh/m² (index 0 = January). */
  monthlyKWhM2: number[];
  /** Mean daily irradiation for the current month, kWh/m²·day. */
  todayKWhM2: number;
  /** Equivalent mid-day plane irradiance for the current month, W/m². */
  peakWM2: number;
}

export interface SolarExposure {
  /** 1 = live/fresh PVGIS, 2 = cached (possibly stale), 3 = unavailable. */
  tier: 1 | 2 | 3;
  source: "live" | "cache" | "stale-cache" | "unavailable";
  fetchedAt: string | null;
  facades: FacadeSolar[];
  /** Shading from neighbouring buildings is NOT modelled — see note. */
  shadingModelled: false;
  error?: string;
}

export const ORIENTATION_BEARING: Record<Orientation, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
  internal: -1,
};

/** Compass bearing (0 = N, clockwise) → PVGIS aspect (0 = S), in (−180, 180]. */
export function compassToAspect(bearingDeg: number): number {
  let a = bearingDeg - 180;
  while (a <= -180) a += 360;
  while (a > 180) a -= 360;
  return Math.round(a);
}

export const SHADING_DISCLAIMER =
  "Shading from neighbouring buildings and terrain is not modelled in this demo; every facade is assumed unshaded, so solar gain is an upper bound.";
