// Core types for the AI-assisted, weight-tunable optimization layer.
//
// Pipeline: signal sources -> optional modifiers -> AI reasoning -> a
// deterministic combiner (weighted by manager-set signal weights) -> a full
// reasoning trace the UI can render. See engine.ts for the orchestration.

export type SignalCategory =
  | "physics"
  | "weather"
  | "solar"
  | "building"
  | "occupancy"
  | "room-learning"
  | "sensor"
  | "feedback";

/** One normalized reading from a signal source, after any modifiers run. */
export interface SignalReading {
  id: string; // e.g. "weather.outdoor_temp" — stable, used as the weight key
  label: string; // human label for the UI
  category: SignalCategory;
  value: number;
  unit: string;
  /** 1 = live/fresh, 2 = cached/stale, 3 = unavailable/estimated. */
  tier: 1 | 2 | 3;
  /** Source-reported confidence, 0..1, before any modifier discount. */
  confidence: number;
  detail?: string;
  asOf: string | null;
}

/** An AI-produced judgment about one signal's effect on the setback. */
export interface AiJudgment {
  signalId: string;
  /** Suggested nudge to the setback, °C. +warmer/safer, −cooler/more savings. */
  directionC: number;
  confidence: number; // 0..1
  rationale: string;
}

export type ReasoningEngine = "llm" | "rule-based";

export interface AiReasoning {
  judgments: AiJudgment[];
  narrative: string;
  engine: ReasoningEngine;
  model?: string;
}

/** Manager-tunable weight per signal id, 0 (ignore) .. 2 (double weight). */
export type SignalWeights = Record<string, number>;

export type AiMode = "ai" | "override";

/** Per-room settings a manager can tune from the UI. Persisted client-side. */
export interface AiSettings {
  mode: AiMode;
  overrideSetpointC: number | null;
  weights: SignalWeights;
  /** Manual calibration offset applied to a signal's raw value pre-reasoning. */
  calibration: Record<string, number>;
  /** Demo/testing signal overrides: replaces a signal's live value and forces
   *  it to tier 1, so it participates in reasoning as if it were live —
   *  including a signal that's currently unavailable. Keyed by signal id. */
  mockSignals: Record<string, number>;
  updatedAt: string;
}

/** One row of the reasoning trace the UI renders, in signal order. */
export interface TraceRow {
  signal: SignalReading;
  judgment: AiJudgment | null; // null only if the reasoner produced nothing
  weight: number;
  /** weight * judgment.directionC — 0 for physics baseline rows. */
  contributionC: number;
}

export interface OptimizationResult {
  setbackC: number;
  physicsBaselineC: number;
  recoveryMinutes: number;
  savingsPct: number;
  savingsKwhPerDay: number;
  confidence: number;
  mode: AiMode;
  reasoningEngine: ReasoningEngine | "override";
  model?: string;
  narrative: string;
  trace: TraceRow[];
  computedAt: string;
}

export const DEFAULT_WEIGHT = 1;
export const MIN_WEIGHT = 0;
export const MAX_WEIGHT = 2;
