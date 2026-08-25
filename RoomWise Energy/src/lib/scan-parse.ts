// Shared LiDAR Record parser used by both the upload UI and the ingest API.

import type { RoomScanRecord } from "./types";
import { isSkanzaRecord, parseSkanzaPlan, facadesFromPlan, planFromFacades } from "./floorplan";

export function parseRecord(input: string | unknown): RoomScanRecord {
  const raw: unknown = typeof input === "string" ? JSON.parse(input) : input;
  if (!raw || typeof raw !== "object") throw new Error("Not a JSON object.");

  // Native Skanza FloorPlanLibrary.Record: derive facades from real geometry.
  if (isSkanzaRecord(raw)) {
    const openings = raw.model?.wallOpenings ?? [];
    const ceilingHeight =
      openings.find((o) => (o.verticals?.heightMeters ?? 0) > 1.8)?.verticals?.heightMeters ?? 2.6;
    const plan = parseSkanzaPlan(raw, ceilingHeight);
    if (!plan) throw new Error("Record model has no usable wall dimensions.");
    const rec: RoomScanRecord = {
      recordId: raw.id ?? "SKANZA_RECORD",
      ceilingHeight,
      facades: facadesFromPlan(plan, ceilingHeight),
      plan,
    };
    if (typeof raw.latitude === "number" && typeof raw.longitude === "number")
      rec.gps = { lat: raw.latitude, long: raw.longitude };
    return rec;
  }

  const data = raw as RoomScanRecord;
  if (!Array.isArray(data.facades) || data.facades.length === 0)
    throw new Error("Record must include a non-empty facades array.");
  if (typeof data.ceilingHeight !== "number")
    throw new Error("Record must include numeric ceilingHeight.");
  for (const f of data.facades) {
    if (typeof f.area !== "number" || typeof f.glazingArea !== "number")
      throw new Error("Each facade needs numeric area and glazingArea.");
  }
  return { ...data, plan: planFromFacades(data.facades, data.ceilingHeight) };
}
