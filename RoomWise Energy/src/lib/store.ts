// RoomSense room store — backed by the Lovable Cloud database.
// SSR renders the deterministic SEED snapshot; the browser loads real rows
// after mount, seeding the database on first run so the demo is never empty.

import { useSyncExternalStore } from "react";
import type { Facade, RoomRecord, RoomScanRecord } from "./types";
import { SEED_ROOMS } from "./sample-data";
import { computeSetback } from "./thermal";
import { isSkanzaRecord, parseSkanzaPlan, planFromFacades } from "./floorplan";
import type { RoomPlan } from "./floorplan";
import { supabase } from "@/integrations/supabase/client";

interface StoreState {
  rooms: RoomRecord[];
  loading: boolean;
}

let state: StoreState = { rooms: SEED_ROOMS, loading: false };
let hydrated = false;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: StoreState) {
  state = next;
  emit();
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): StoreState {
  return state;
}

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getRoom(id: string): RoomRecord | undefined {
  return state.rooms.find((r) => r.id === id);
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function recompute(
  facades: Facade[],
  ceilingHeight: number,
  floorNumber: number,
  totalLevels: number,
  lat: number,
  long: number,
) {
  return computeSetback({ facades, ceilingHeight, floorNumber, totalLevels, lat, long });
}

/** Recover 2D geometry: real scan plan when stored, else a derived rectangle. */
function planOf(rawScan: unknown, facades: Facade[], ceilingHeight: number): RoomPlan {
  const stored = (rawScan as { plan?: RoomPlan } | null)?.plan;
  if (stored?.walls?.length && stored.source === "scan") return stored;
  if (isSkanzaRecord(rawScan)) {
    const parsed = parseSkanzaPlan(rawScan, ceilingHeight);
    if (parsed) return parsed;
  }
  return planFromFacades(facades, ceilingHeight);
}

/** Read every room + property + facade set back into RoomRecord shape. */
async function fetchRooms(): Promise<RoomRecord[]> {
  const { data, error } = await supabase
    .from("rooms")
    .select(
      "id, label, floor_number, ceiling_height_m, source_file, created_at, property_id, raw_scan_json, properties(id, slug, name, latitude, longitude, total_levels), room_facades(id, compass_bearing_deg, window_area_m2, wall_area_m2, wall_id), recommendations(detail_json, computed_at)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const prop = row.properties as unknown as {
      slug: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
      total_levels: number | null;
    } | null;
    const facades: Facade[] =
      ((row.recommendations?.[0]?.detail_json as { facades?: Facade[] } | null)?.facades ??
        []) as Facade[];
    const lat = prop?.latitude ?? 59.33;
    const long = prop?.longitude ?? 18.06;
    const totalLevels = prop?.total_levels ?? 8;
    const result = recompute(
      facades,
      row.ceiling_height_m,
      row.floor_number,
      totalLevels,
      lat,
      long,
    );
    return {
      id: row.id,
      propertyId: prop?.slug ?? row.property_id,
      propertyName: prop?.name ?? "Unassigned",
      label: row.label,
      floorNumber: row.floor_number,
      totalLevels,
      lat,
      long,
      ceilingHeight: row.ceiling_height_m,
      facades,
      plan: planOf(row.raw_scan_json, facades, row.ceiling_height_m),
      createdAt: row.created_at,
      result,
      ...(row.source_file ? { sourceFile: row.source_file } : {}),
    } satisfies RoomRecord;
  });
}

async function upsertProperty(input: {
  name: string;
  lat: number;
  long: number;
  totalLevels: number;
}) {
  const slug = slugify(input.name);
  const { data } = await supabase
    .from("properties")
    .upsert(
      {
        slug,
        name: input.name,
        latitude: input.lat,
        longitude: input.long,
        total_levels: input.totalLevels,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  return data?.id as string | undefined;
}

async function insertRoom(input: NewRoomInput): Promise<RoomRecord | null> {
  const propertyId = await upsertProperty({
    name: input.propertyName,
    lat: input.lat,
    long: input.long,
    totalLevels: input.totalLevels,
  });
  if (!propertyId) return null;

  const result = recompute(
    input.scan.facades,
    input.scan.ceilingHeight,
    input.floorNumber,
    input.totalLevels,
    input.lat,
    input.long,
  );

  const { data: room, error } = await supabase
    .from("rooms")
    .insert({
      property_id: propertyId,
      label: input.label,
      floor_number: input.floorNumber,
      ceiling_height_m: input.scan.ceilingHeight,
      footprint_area_m2: result.footprint,
      source_file: input.sourceFile ?? null,
      raw_scan_json: input.scan as unknown as never,
    })
    .select("id, created_at")
    .single();
  if (error || !room) return null;

  await supabase.from("room_facades").insert(
    input.scan.facades.map((f) => ({
      room_id: room.id,
      compass_bearing_deg: bearingOf(f),
      window_area_m2: f.glazingArea,
      wall_area_m2: f.area,
      wall_id: f.id,
    })),
  );

  await writeRecommendation(room.id, input.scan.facades, result);

  return {
    id: room.id,
    propertyId: slugify(input.propertyName),
    propertyName: input.propertyName,
    label: input.label,
    floorNumber: input.floorNumber,
    totalLevels: input.totalLevels,
    lat: input.lat,
    long: input.long,
    ceilingHeight: input.scan.ceilingHeight,
    facades: input.scan.facades,
    plan:
      input.scan.plan ??
      planFromFacades(input.scan.facades, input.scan.ceilingHeight),
    createdAt: room.created_at,
    result,
    ...(input.sourceFile ? { sourceFile: input.sourceFile } : {}),
  };
}

const BEARINGS: Record<string, number> = {
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

function bearingOf(f: Facade) {
  return BEARINGS[f.orientation] ?? -1;
}

async function writeRecommendation(
  roomId: string,
  facades: Facade[],
  result: RoomRecord["result"],
) {
  await supabase.from("recommendations").insert({
    room_id: roomId,
    recommended_setpoint: result.setbackC,
    recovery_minutes: Math.round((result.uaTotal > 0 ? 90 : 60) * 1),
    savings_estimate: Math.round(result.uaTotal * 0.9),
    confidence_tier:
      result.confidence >= 0.8 ? "tier1" : result.confidence >= 0.6 ? "tier2" : "tier3",
    confidence: result.confidence,
    explanation_text: result.notes.join(" "),
    detail_json: { facades, result } as unknown as never,
  });
}

/** Seed the database on first run so the portfolio demo is never empty. */
async function seedIfEmpty() {
  const { count } = await supabase.from("rooms").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;
  for (const r of [...SEED_ROOMS].reverse()) {
    await insertRoom({
      scan: {
        recordId: r.id,
        ceilingHeight: r.ceilingHeight,
        facades: r.facades,
      },
      propertyName: r.propertyName,
      label: r.label,
      floorNumber: r.floorNumber,
      totalLevels: r.totalLevels,
      lat: r.lat,
      long: r.long,
    });
  }
}

export async function hydrateStore() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  setState({ ...state, loading: true });
  try {
    await seedIfEmpty();
    const rooms = await fetchRooms();
    setState({ rooms: rooms.length ? rooms : SEED_ROOMS, loading: false });
  } catch {
    setState({ ...state, loading: false });
  }
}

export interface NewRoomInput {
  scan: RoomScanRecord;
  propertyName: string;
  label: string;
  floorNumber: number;
  totalLevels: number;
  lat: number;
  long: number;
  sourceFile?: string;
}

export async function addRoom(input: NewRoomInput): Promise<RoomRecord | null> {
  const room = await insertRoom(input);
  if (room) setState({ ...state, rooms: [room, ...state.rooms] });
  return room;
}

export async function updateRoom(
  id: string,
  patch: Partial<Pick<RoomRecord, "floorNumber" | "totalLevels" | "lat" | "long">>,
) {
  const current = getRoom(id);
  if (!current) return;
  const next = { ...current, ...patch };
  next.result = recompute(
    next.facades,
    next.ceilingHeight,
    next.floorNumber,
    next.totalLevels,
    next.lat,
    next.long,
  );
  setState({ ...state, rooms: state.rooms.map((r) => (r.id === id ? next : r)) });

  await supabase.from("rooms").update({ floor_number: next.floorNumber }).eq("id", id);
  const { data: room } = await supabase
    .from("rooms")
    .select("property_id")
    .eq("id", id)
    .single();
  if (room?.property_id) {
    await supabase
      .from("properties")
      .update({
        latitude: next.lat,
        longitude: next.long,
        total_levels: next.totalLevels,
      })
      .eq("id", room.property_id);
  }
  await writeRecommendation(id, next.facades, next.result);
}

export async function deleteRoom(id: string) {
  setState({ ...state, rooms: state.rooms.filter((r) => r.id !== id) });
  await supabase.from("rooms").delete().eq("id", id);
}

/** Wipe the database back to the built-in demo portfolio. */
export async function resetStore() {
  setState({ ...state, loading: true });
  await supabase.from("rooms").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await seedIfEmpty();
  const rooms = await fetchRooms();
  setState({ rooms: rooms.length ? rooms : SEED_ROOMS, loading: false });
}
