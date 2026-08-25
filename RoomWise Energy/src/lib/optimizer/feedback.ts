// Two more signal inputs, closing the loop between the recommendation and
// what actually happened in the room: a live room-sensor reading (the
// thermostat, or whatever IoT feed a property has — synthetic/manual entry
// today, wired to a real device feed later without touching signals.ts) and
// a guest/staff feedback log ("too cold" / "too warm" complaints). Same
// localStorage-backed pattern as settings.ts, so both are per-room, editable
// from the room's own AI panel, and swappable for a Supabase table later.

import { useSyncExternalStore } from "react";

export interface RoomSensorReading {
  temperatureC: number;
  updatedAt: string;
}

export type FeedbackSentiment = "too_cold" | "fine" | "too_warm";

export interface FeedbackEntry {
  id: string;
  sentiment: FeedbackSentiment;
  note?: string;
  createdAt: string;
}

const SENSOR_PREFIX = "roomwise.sensor.";
const FEEDBACK_PREFIX = "roomwise.feedback.";
const MAX_FEEDBACK_ENTRIES = 20;
/** Entries older than this don't count toward the live sentiment signal —
 *  stale complaints shouldn't keep nudging today's setpoint. */
const FEEDBACK_WINDOW_MS = 7 * 24 * 3600_000;
/** A sensor reading older than this is treated as stale (tier 2) rather than live. */
const SENSOR_FRESH_MS = 6 * 3600_000;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// --- Room sensor -----------------------------------------------------------

const sensorCache = new Map<string, RoomSensorReading | null>();
const sensorListeners = new Map<string, Set<() => void>>();

function readSensor(roomId: string): RoomSensorReading | null {
  if (!sensorCache.has(roomId)) {
    const value =
      typeof window === "undefined"
        ? null
        : safeParse<RoomSensorReading | null>(
            window.localStorage.getItem(SENSOR_PREFIX + roomId),
            null,
          );
    sensorCache.set(roomId, value);
  }
  return sensorCache.get(roomId) ?? null;
}

export function getSensorReading(roomId: string): RoomSensorReading | null {
  return readSensor(roomId);
}

export function setSensorReading(roomId: string, temperatureC: number) {
  const reading: RoomSensorReading = { temperatureC, updatedAt: new Date().toISOString() };
  sensorCache.set(roomId, reading);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SENSOR_PREFIX + roomId, JSON.stringify(reading));
    } catch {
      // Storage full/blocked — reading just won't persist across reloads.
    }
  }
  for (const l of sensorListeners.get(roomId) ?? []) l();
}

export function isSensorFresh(reading: RoomSensorReading | null): boolean {
  if (!reading) return false;
  return Date.now() - new Date(reading.updatedAt).getTime() < SENSOR_FRESH_MS;
}

export function useSensorReading(roomId: string): RoomSensorReading | null {
  return useSyncExternalStore(
    (cb) => {
      if (!sensorListeners.has(roomId)) sensorListeners.set(roomId, new Set());
      sensorListeners.get(roomId)!.add(cb);
      return () => sensorListeners.get(roomId)?.delete(cb);
    },
    () => readSensor(roomId),
    () => null,
  );
}

// --- Guest/staff feedback ----------------------------------------------------

const feedbackCache = new Map<string, FeedbackEntry[]>();
const feedbackListeners = new Map<string, Set<() => void>>();

function readFeedback(roomId: string): FeedbackEntry[] {
  if (!feedbackCache.has(roomId)) {
    const value =
      typeof window === "undefined"
        ? []
        : safeParse<FeedbackEntry[]>(window.localStorage.getItem(FEEDBACK_PREFIX + roomId), []);
    feedbackCache.set(roomId, value);
  }
  return feedbackCache.get(roomId) ?? [];
}

export function getFeedback(roomId: string): FeedbackEntry[] {
  return readFeedback(roomId);
}

export function addFeedback(roomId: string, sentiment: FeedbackSentiment, note?: string) {
  const entry: FeedbackEntry = {
    id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    sentiment,
    createdAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  };
  const next = [entry, ...readFeedback(roomId)].slice(0, MAX_FEEDBACK_ENTRIES);
  feedbackCache.set(roomId, next);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(FEEDBACK_PREFIX + roomId, JSON.stringify(next));
    } catch {
      // Storage full/blocked — entry just won't persist across reloads.
    }
  }
  for (const l of feedbackListeners.get(roomId) ?? []) l();
}

export function recentFeedback(entries: FeedbackEntry[]): FeedbackEntry[] {
  const cutoff = Date.now() - FEEDBACK_WINDOW_MS;
  return entries.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
}

/** Net sentiment over the recent window, -1 (all "too warm") .. +1 (all "too cold"). */
export function sentimentScore(entries: FeedbackEntry[]): number | null {
  const recent = recentFeedback(entries).filter((e) => e.sentiment !== "fine");
  if (!recent.length) return null;
  const net = recent.reduce((s, e) => s + (e.sentiment === "too_cold" ? 1 : -1), 0);
  return net / recent.length;
}

export function useFeedback(roomId: string): FeedbackEntry[] {
  return useSyncExternalStore(
    (cb) => {
      if (!feedbackListeners.has(roomId)) feedbackListeners.set(roomId, new Set());
      feedbackListeners.get(roomId)!.add(cb);
      return () => feedbackListeners.get(roomId)?.delete(cb);
    },
    () => readFeedback(roomId),
    () => [],
  );
}
