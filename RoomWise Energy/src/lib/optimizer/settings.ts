// Per-room AI settings: mode (AI vs manual override), per-signal weights, and
// calibration offsets. Kept in localStorage — this is manager preference, not
// shared portfolio data, and it keeps the settings panel usable with zero
// backend setup during the hackathon. Swap for a Supabase table later without
// touching the panel: only getAiSettings/setAiSettings change.

import { useSyncExternalStore } from "react";
import type { AiSettings } from "./types";

const STORAGE_PREFIX = "roomwise.ai-settings.";

export function defaultAiSettings(): AiSettings {
  return {
    mode: "ai",
    overrideSetpointC: null,
    weights: {},
    calibration: {},
    mockSignals: {},
    updatedAt: new Date(0).toISOString(),
  };
}

function key(roomId: string) {
  return `${STORAGE_PREFIX}${roomId}`;
}

// In-memory cache holding one stable object reference per room, so repeated
// useSyncExternalStore snapshot reads don't allocate a new object every
// render (which would defeat React's Object.is change check).
const cache = new Map<string, AiSettings>();

function readFromStorage(roomId: string): AiSettings {
  if (typeof window === "undefined") return defaultAiSettings();
  try {
    const raw = window.localStorage.getItem(key(roomId));
    if (!raw) return defaultAiSettings();
    return { ...defaultAiSettings(), ...(JSON.parse(raw) as Partial<AiSettings>) };
  } catch {
    return defaultAiSettings();
  }
}

function read(roomId: string): AiSettings {
  let cached = cache.get(roomId);
  if (!cached) {
    cached = readFromStorage(roomId);
    cache.set(roomId, cached);
  }
  return cached;
}

function write(roomId: string, settings: AiSettings) {
  cache.set(roomId, settings);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(roomId), JSON.stringify(settings));
  } catch {
    // Storage full/blocked — settings just won't persist across reloads.
  }
}

const listeners = new Map<string, Set<() => void>>();

function emit(roomId: string) {
  for (const l of listeners.get(roomId) ?? []) l();
}

export function getAiSettings(roomId: string): AiSettings {
  return read(roomId);
}

export function updateAiSettings(roomId: string, patch: Partial<AiSettings>): AiSettings {
  const next: AiSettings = { ...read(roomId), ...patch, updatedAt: new Date().toISOString() };
  write(roomId, next);
  emit(roomId);
  return next;
}

export function setSignalWeight(roomId: string, signalId: string, weight: number) {
  const current = read(roomId);
  return updateAiSettings(roomId, { weights: { ...current.weights, [signalId]: weight } });
}

const SERVER_SNAPSHOT = defaultAiSettings();

/** React hook: subscribes a component to one room's AI settings. */
export function useAiSettings(roomId: string): AiSettings {
  return useSyncExternalStore(
    (cb) => {
      if (!listeners.has(roomId)) listeners.set(roomId, new Set());
      listeners.get(roomId)!.add(cb);
      return () => listeners.get(roomId)?.delete(cb);
    },
    () => read(roomId),
    () => SERVER_SNAPSHOT,
  );
}
