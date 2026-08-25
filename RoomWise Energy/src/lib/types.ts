// Core domain types for RoomSense per-room energy optimization.

import type { RoomPlan } from "./floorplan";

export type Orientation =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW"
  | "internal";

/** A single building facade (wall) derived from a LiDAR scan. */
export interface Facade {
  id: string;
  orientation: Orientation;
  /** Gross wall area, m² */
  area: number;
  /** Glazed portion of the wall, m² */
  glazingArea: number;
  /** Opaque-wall U-value, W/m²·K */
  uValue: number;
}

/** The raw LiDAR Record JSON a user drops into the upload flow. */
export interface RoomScanRecord {
  recordId: string;
  ceilingHeight: number;
  facades: Facade[];
  gps?: { lat: number; long: number };
  floorNumber?: number;
  /** Real 2D geometry, present when a native Skanza Record was uploaded. */
  plan?: RoomPlan;
}

/** A stored room, with its computed optimization result. */
export interface RoomRecord {
  id: string;
  propertyId: string;
  propertyName: string;
  label: string;
  floorNumber: number;
  totalLevels: number;
  lat: number;
  long: number;
  ceilingHeight: number;
  facades: Facade[];
  sourceFile?: string;
  createdAt: string;
  plan?: RoomPlan;
  result: SetbackResult;
}

export interface FacadeUA {
  id: string;
  orientation: Orientation;
  wallUa: number;
  glazingUa: number;
  totalUa: number;
  glazingPct: number;
}

/** Output of the pure setback-optimization engine. */
export interface SetbackResult {
  /** Recommended unoccupied setback temperature, °C */
  setbackC: number;
  /** Total heat-loss coefficient, W/K */
  uaTotal: number;
  /** UA normalized by floor footprint, W/K·m² */
  uaDensity: number;
  /** Peak solar gain through glazing, W */
  solarPeakW: number;
  /** Average solar heat-gain coefficient */
  solarGValue: number;
  /** Footprint floor area used, m² */
  footprint: number;
  wallUa: number;
  glazingUa: number;
  roofUa: number;
  floorUa: number;
  facades: FacadeUA[];
  /** Confidence in the recommendation, 0..1 */
  confidence: number;
  notes: string[];
}
