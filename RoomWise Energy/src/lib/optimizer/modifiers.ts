// Optional per-signal modifiers: pure (reading, context) => reading
// transforms that run after collection and before AI reasoning. Neither the
// reasoner nor the combiner needs to know a modifier ran — they just see an
// already-adjusted SignalReading. Add new modifiers here without touching
// signals.ts, reasoner.ts, or combine.ts.

import type { SignalReading } from "./types";

export interface ModifierContext {
  /** Manager-entered value offsets, keyed by signal id. Off (0) by default. */
  calibration: Record<string, number>;
  /** Demo/testing overrides, keyed by signal id. When set, replaces the raw
   *  value and forces the reading to look live — see mockOverride below. */
  mockSignals?: Record<string, number>;
}

/** Manual calibration — e.g. "our weather station reads 1° warm." */
function calibrate(reading: SignalReading, ctx: ModifierContext): SignalReading {
  const offset = ctx.calibration[reading.id];
  if (!offset) return reading;
  return {
    ...reading,
    value: reading.value + offset,
    detail: [reading.detail, `Calibrated ${offset > 0 ? "+" : ""}${offset} ${reading.unit}.`]
      .filter(Boolean)
      .join(" "),
  };
}

/** Staleness decay — tier 2/3 readings get an extra confidence haircut so a
 *  cached-but-old signal never carries as much weight as a fresh one, even
 *  before the manager's own weight slider is applied. */
function decayStaleness(reading: SignalReading): SignalReading {
  if (reading.tier === 1) return reading;
  const factor = reading.tier === 2 ? 0.75 : 0.4;
  return { ...reading, confidence: Math.round(reading.confidence * factor * 100) / 100 };
}

/** Demo override — punches a manual value in and forces the reading to tier 1
 *  so it reasons exactly like a live one, even if the real source is down.
 *  Wins over calibration/staleness: it runs last and replaces the value
 *  outright rather than nudging it. */
function mockOverride(reading: SignalReading, ctx: ModifierContext): SignalReading {
  const value = ctx.mockSignals?.[reading.id];
  if (value === undefined) return reading;
  return {
    ...reading,
    value,
    tier: 1,
    confidence: Math.max(reading.confidence, 0.9),
    detail: "Mocked for demo — value entered manually, not live.",
  };
}

export function applyModifiers(signals: SignalReading[], ctx: ModifierContext): SignalReading[] {
  return signals.map((s) => mockOverride(decayStaleness(calibrate(s, ctx)), ctx));
}
