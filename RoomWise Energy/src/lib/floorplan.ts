// 2D floor-plan geometry: parse a native Skanza Record model, or synthesize a
// plan from derived facades. All coordinates are metres in a north-up frame
// (+x = east, +y = north). Pure functions, no I/O.

import type { Facade, Orientation } from "./types";

export type Pt = { x: number; y: number };

export interface PlanWall {
  id: string;
  start: Pt;
  end: Pt;
  /** Outward compass bearing, degrees clockwise from true north */
  bearing: number;
  lengthM: number;
  external: boolean;
  orientation: Orientation;
  /** Window openings as fractional spans [t0, t1] along the wall */
  windows: Array<{ t0: number; t1: number }>;
  glazingArea: number;
}

export interface RoomPlan {
  outline: Pt[];
  walls: PlanWall[];
  /** Where the geometry came from */
  source: "scan" | "derived";
  footprintM2: number;
}

const RAD = Math.PI / 180;

export function bearingToOrientation(b: number): Orientation {
  const dirs: Orientation[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round((((b % 360) + 360) % 360) / 45) % 8;
  return dirs[idx]!;
}

export const ORIENTATION_TO_BEARING: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

function polygonArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

// --- Native Skanza Record parsing -----------------------------------------

type Vec2 = [number, number];

interface SkanzaModel {
  northDirection?: Vec2;
  floors?: Array<{ areaSquareMeters?: number; outline?: Vec2[] }>;
  dimensions?: Array<{
    wallID: string;
    outwardNormal: Vec2;
    lengthMeters: number;
    start: Vec2;
    end: Vec2;
  }>;
  wallOpenings?: Array<{
    wallID: string;
    isWindowOnly?: boolean;
    start: Vec2;
    end: Vec2;
    verticals?: { elevationMeters?: number; heightMeters?: number };
  }>;
}

export interface SkanzaRecord {
  id?: string;
  latitude?: number | null;
  longitude?: number | null;
  model?: SkanzaModel;
}

export function isSkanzaRecord(json: unknown): json is SkanzaRecord {
  const m = (json as SkanzaRecord | null)?.model;
  return !!m && (Array.isArray(m.dimensions) || Array.isArray(m.floors));
}

/** Rotate plan-local coords so that `northDirection` points to +y. */
function northUpRotation(north?: Vec2): (p: Vec2) => Pt {
  const [nx, ny] = north && north.length === 2 ? north : [0, 1];
  const theta = Math.atan2(nx, ny); // angle to rotate north onto +y
  const cos = Math.cos(-theta);
  const sin = Math.sin(-theta);
  return ([x, y]) => ({ x: x * cos - y * sin, y: x * sin + y * cos });
}

function dist(a: Pt, b: Pt) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function parseSkanzaPlan(
  rec: SkanzaRecord,
  ceilingHeight: number,
): RoomPlan | null {
  const model = rec.model;
  if (!model) return null;
  const rot = northUpRotation(model.northDirection);
  const dims = model.dimensions ?? [];
  if (dims.length === 0) return null;

  const openings = (model.wallOpenings ?? []).filter((o) => o.isWindowOnly !== false);

  const walls: PlanWall[] = dims.map((d, i) => {
    const start = rot(d.start);
    const end = rot(d.end);
    const n = rot(d.outwardNormal);
    const bearing = (((Math.atan2(n.x, n.y) / RAD) % 360) + 360) % 360;
    const lengthM = d.lengthMeters ?? dist(start, end);
    const wallOpenings = openings.filter((o) => o.wallID === d.wallID);
    const windows = wallOpenings.map((o) => {
      const os = rot(o.start);
      const oe = rot(o.end);
      const t0 = lengthM > 0 ? dist(start, os) / lengthM : 0;
      const t1 = lengthM > 0 ? dist(start, oe) / lengthM : 0;
      return { t0: Math.min(t0, t1), t1: Math.max(t0, t1) };
    });
    const glazingArea = wallOpenings.reduce((s, o) => {
      const w = dist(rot(o.start), rot(o.end));
      const h = o.verticals?.heightMeters ?? 1.4;
      return s + w * h;
    }, 0);
    return {
      id: d.wallID || `W${i + 1}`,
      start,
      end,
      bearing,
      lengthM,
      external: true,
      orientation: bearingToOrientation(bearing),
      windows,
      glazingArea,
    };
  });

  const outlineRaw = model.floors?.[0]?.outline;
  const outline =
    outlineRaw && outlineRaw.length >= 3
      ? outlineRaw.map(rot)
      : walls.map((w) => w.start);

  const footprintM2 =
    model.floors?.[0]?.areaSquareMeters ?? polygonArea(outline) ?? 0;

  return { outline, walls, source: "scan", footprintM2 };
}

/** Facades derived from real scan geometry. */
export function facadesFromPlan(plan: RoomPlan, ceilingHeight: number): Facade[] {
  return plan.walls.map((w) => ({
    id: w.id,
    orientation: w.orientation,
    area: w.lengthM * ceilingHeight,
    glazingArea: Math.min(w.glazingArea, w.lengthM * ceilingHeight * 0.9),
    uValue: 0.3,
  }));
}

// --- Synthesized plan from facade summaries --------------------------------

/**
 * When only facade summaries exist (no scan geometry), lay out an axis-aligned
 * rectangle in the compass frame and attach each facade to its nearest side.
 */
export function planFromFacades(
  facades: Facade[],
  ceilingHeight: number,
): RoomPlan {
  const h = ceilingHeight > 0 ? ceilingHeight : 2.7;
  const sides: Array<{ bearing: number; name: Orientation }> = [
    { bearing: 0, name: "N" },
    { bearing: 90, name: "E" },
    { bearing: 180, name: "S" },
    { bearing: 270, name: "W" },
  ];

  const assigned = new Map<number, Facade>();
  for (const f of facades) {
    if (f.orientation === "internal" || f.area <= 0) continue;
    const b = ORIENTATION_TO_BEARING[f.orientation] ?? 0;
    let best = sides[0]!;
    let bestDelta = 999;
    for (const s of sides) {
      const d = Math.abs(((b - s.bearing + 540) % 360) - 180);
      if (d < bestDelta && !assigned.has(s.bearing)) {
        bestDelta = d;
        best = s;
      }
    }
    if (!assigned.has(best.bearing)) assigned.set(best.bearing, f);
  }

  const lenOf = (bearing: number, fallback: number) => {
    const f = assigned.get(bearing);
    return f ? Math.max(1.5, f.area / h) : fallback;
  };
  const width = Math.max(lenOf(0, 0), lenOf(180, 0)) || 4.2; // N/S walls run E-W
  const depth = Math.max(lenOf(90, 0), lenOf(270, 0)) || 5.4;

  const hw = width / 2;
  const hd = depth / 2;
  const nw = { x: -hw, y: hd };
  const ne = { x: hw, y: hd };
  const se = { x: hw, y: -hd };
  const sw = { x: -hw, y: -hd };
  const outline = [nw, ne, se, sw];

  const segs: Array<{ bearing: number; start: Pt; end: Pt }> = [
    { bearing: 0, start: nw, end: ne },
    { bearing: 90, start: ne, end: se },
    { bearing: 180, start: se, end: sw },
    { bearing: 270, start: sw, end: nw },
  ];

  const walls: PlanWall[] = segs.map((s, i) => {
    const f = assigned.get(s.bearing);
    const lengthM = dist(s.start, s.end);
    const glazingArea = f?.glazingArea ?? 0;
    const winLen = Math.min(lengthM * 0.8, glazingArea / (h * 0.55));
    const frac = lengthM > 0 ? winLen / lengthM : 0;
    return {
      id: f?.id ?? `INT${i + 1}`,
      start: s.start,
      end: s.end,
      bearing: s.bearing,
      lengthM,
      external: !!f,
      orientation: f ? f.orientation : "internal",
      windows: glazingArea > 0 ? [{ t0: 0.5 - frac / 2, t1: 0.5 + frac / 2 }] : [],
      glazingArea,
    };
  });

  return { outline, walls, source: "derived", footprintM2: width * depth };
}
