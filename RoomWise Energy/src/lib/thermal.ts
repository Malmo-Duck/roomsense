// RoomSense setback-optimization engine — a pure function.
// No I/O, no globals: hand-pick inputs, assert on outputs. Unit-testable.
//
// Model intent (hackathon-grade, deliberately transparent):
//  - UA = Σ opaque walls + Σ glazing + roof (top floor) + slab (ground floor).
//  - Solar gain = Σ glazing × SHGC × orientation × peak irradiance.
//  - Setback: leakier rooms (high UA/m²) need a warmer setback; sun-loaded /
//    thermally massive rooms tolerate a cooler setback.
//  - Confidence: weighted sum of data-completeness signals, damped by extremes.

import type { Facade, Orientation, SetbackResult, FacadeUA } from "./types";

// --- Physical constants (SI) ----------------------------------------------
const U_GLAZING = 1.4; // W/m²·K, double-pane
const U_ROOF = 0.18; // W/m²·K, insulated roof
const U_FLOOR_SLAB = 0.15; // W/m²·K, ground slab
const SHGC = 0.6; // solar heat-gain coefficient, typical double pane
const PEAK_IRRADIANCE = 820; // W/m², clear-sky equinox noon
const BASE_SETBACK = 16; // °C, typical unoccupied hotel setback
export const MIN_SETBACK = 13.5;
export const MAX_SETBACK = 20;
/** Single building-wide setpoint the AI-optimized, per-room setback is
 *  measured against — see optimizer/combine.ts. Same value the physics
 *  engine itself centers on, so "flat policy" and "day-one baseline" agree. */
export const FLAT_BASELINE_SETBACK = BASE_SETBACK;

// Orientation → fraction of peak irradiance reaching the facade at peak.
const ORIENTATION_SOLAR: Record<Orientation, number> = {
  S: 1.0,
  SE: 0.78,
  SW: 0.78,
  E: 0.55,
  W: 0.55,
  NE: 0.32,
  NW: 0.32,
  N: 0.18,
  internal: 0,
};

const ORIENTATIONS: Orientation[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "internal"];

export function isExternal(o: Orientation): boolean {
  return o !== "internal";
}

/** Opposing cardinal pair used to recover the room footprint. */
function footprintFromFacades(facades: Facade[], ceilingHeight: number): number {
  const byDir = (o: Orientation) =>
    facades.filter((f) => f.orientation === o).reduce((s, f) => s + f.area, 0);

  // Treat N/S as one span and E/W as the other; a rectangle's two opposite
  // walls share a length, so width = area/height for each axis.
  const ns = Math.max(byDir("N"), byDir("S"));
  const ew = Math.max(byDir("E"), byDir("W"));
  const h = ceilingHeight > 0 ? ceilingHeight : 2.7;
  const width = ns > 0 ? ns / h : 0;
  const length = ew > 0 ? ew / h : 0;
  if (width > 0 && length > 0) return width * length;
  // Fallback: nominal hotel room footprint.
  return 22;
}

export interface ComputeInput {
  facades: Facade[];
  ceilingHeight: number;
  floorNumber: number;
  totalLevels: number;
  lat: number;
  long: number;
}

export function computeSetback(input: ComputeInput): SetbackResult {
  const { facades, ceilingHeight, floorNumber, totalLevels } = input;
  const h = ceilingHeight > 0 ? ceilingHeight : 2.7;
  const levels = totalLevels > 0 ? totalLevels : 1;
  const floor = Math.min(Math.max(floorNumber, 1), levels);
  const position = (floor - 1) / Math.max(levels - 1, 1); // 0 ground → 1 top
  const isTop = floor >= levels;
  const isGround = floor <= 1;

  const footprint = footprintFromFacades(facades, h);

  // Per-fabric UA.
  const facadeRows: FacadeUA[] = facades.map((f) => {
    const opaque = Math.max(f.area - f.glazingArea, 0);
    const wallUa = opaque * f.uValue;
    const glazingUa = f.glazingArea * U_GLAZING;
    const glazingPct = f.area > 0 ? f.glazingArea / f.area : 0;
    return {
      id: f.id,
      orientation: f.orientation,
      wallUa,
      glazingUa,
      totalUa: wallUa + glazingUa,
      glazingPct,
    };
  });

  const wallUa = facadeRows.reduce((s, r) => s + r.wallUa, 0);
  const glazingUa = facadeRows.reduce((s, r) => s + r.glazingUa, 0);
  const roofUa = isTop ? footprint * U_ROOF : 0;
  const floorUa = isGround ? footprint * U_FLOOR_SLAB : 0;
  const uaTotal = wallUa + glazingUa + roofUa + floorUa;
  const uaDensity = footprint > 0 ? uaTotal / footprint : 0;

  // Solar.
  let solarPeakW = 0;
  let glazingTotal = 0;
  for (const f of facades) {
    if (!isExternal(f.orientation)) continue;
    solarPeakW += f.glazingArea * SHGC * ORIENTATION_SOLAR[f.orientation] * PEAK_IRRADIANCE;
    glazingTotal += f.glazingArea;
  }
  const solarGValue = glazingTotal > 0 ? SHGC : 0;

  // Setback recommendation.
  // Leakier per m² → warmer setback; solar load → cooler setback.
  const uaPenalty = (uaDensity - 2.2) * 0.9; // ~0 around a typical 2.2 W/K·m²
  const solarDensity = footprint > 0 ? solarPeakW / footprint : 0;
  const solarBenefit = -solarDensity * 0.012;
  const positionNudge = position * 0.4; // top floors marginally warmer (already in UA, mild double-count guard)
  let setbackC = BASE_SETBACK + uaPenalty + solarBenefit + positionNudge;
  setbackC = Math.min(MAX_SETBACK, Math.max(MIN_SETBACK, setbackC));
  setbackC = Math.round(setbackC * 10) / 10;

  // Confidence: completeness + stability.
  let confidence = 0.3;
  if (Number.isFinite(input.lat) && Number.isFinite(input.long)) confidence += 0.25;
  if (floorNumber > 0 && totalLevels > 0) confidence += 0.25;
  if (facades.some((f) => f.glazingArea > 0)) confidence += 0.12;
  if (facades.filter((f) => isExternal(f.orientation)).length >= 3) confidence += 0.08;
  if (ceilingHeight > 0) confidence += 0.1;
  // Damp when UA density is implausible (very high → model uncertain).
  if (uaDensity > 6) confidence -= 0.12;
  confidence = Math.min(0.99, Math.max(0.3, confidence));

  const notes: string[] = [];
  if (isTop) notes.push("Top floor: roof conduction included in UA.");
  if (isGround) notes.push("Ground floor: slab conduction included in UA.");
  const prime = facadeRows.slice().sort((a, b) => b.totalUa - a.totalUa)[0];
  if (prime) {
    const dir = prime.orientation === "internal" ? "internal" : `${prime.orientation} façade`;
    notes.push(`Primary loss driver: ${dir} (${prime.totalUa.toFixed(1)} W/K).`);
  }
  if (solarDensity > 60)
    notes.push("High solar load, so a cooler setback is tolerated on sunny days.");
  if (uaDensity > 3.5)
    notes.push("Elevated UA density, so setback kept conservative to protect reheat time.");

  return {
    setbackC,
    uaTotal,
    uaDensity,
    solarPeakW,
    solarGValue,
    footprint,
    wallUa,
    glazingUa,
    roofUa,
    floorUa,
    facades: facadeRows,
    confidence,
    notes,
  };
}

export const ORIENTATION_LIST = ORIENTATIONS;
