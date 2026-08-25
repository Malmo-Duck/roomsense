// The deterministic combiner: takes the AI's per-signal judgments and the
// manager's per-signal weights and produces one number, plus every number
// that fed it. Nothing here is a model call — same inputs always produce the
// same output, which is what lets a manager trust the weight sliders.

import type {
  AiJudgment,
  AiMode,
  OptimizationResult,
  ReasoningEngine,
  SignalReading,
  SignalWeights,
  TraceRow,
} from "./types";
import { DEFAULT_WEIGHT, MAX_WEIGHT, MIN_WEIGHT } from "./types";
import { MAX_SETBACK, MIN_SETBACK, FLAT_BASELINE_SETBACK } from "../thermal";

export interface CombineInput {
  physicsSetbackC: number;
  physicsConfidence: number;
  uaTotalWPerK: number;
  outdoorTempC: number | null;
  recoveryRateMinPerDeg: number;
  comfortTempC: number;
  unoccupiedHoursPerDay: number;
  signals: SignalReading[];
  judgments: AiJudgment[];
  weights: SignalWeights;
  mode: AiMode;
  overrideSetpointC: number | null;
  narrative: string;
  reasoningEngine: ReasoningEngine;
  model?: string;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function weightFor(signal: SignalReading, weights: SignalWeights): number {
  if (signal.category === "physics") return 0; // baseline, never a weighted nudge
  const w = weights[signal.id];
  return clamp(w ?? DEFAULT_WEIGHT, MIN_WEIGHT, MAX_WEIGHT);
}

export function combine(input: CombineInput): OptimizationResult {
  const judgmentById = new Map(input.judgments.map((j) => [j.signalId, j]));

  const trace: TraceRow[] = input.signals.map((signal) => {
    const judgment = judgmentById.get(signal.id) ?? null;
    const weight = weightFor(signal, input.weights);
    const contributionC = judgment ? weight * judgment.directionC : 0;
    return { signal, judgment, weight, contributionC };
  });

  const nudgeC = trace.reduce((sum, row) => sum + row.contributionC, 0);
  const aiSetbackC =
    Math.round(clamp(input.physicsSetbackC + nudgeC, MIN_SETBACK, MAX_SETBACK) * 10) / 10;

  const isOverride = input.mode === "override" && input.overrideSetpointC != null;
  const setbackC = isOverride
    ? clamp(input.overrideSetpointC!, MIN_SETBACK, MAX_SETBACK)
    : aiSetbackC;

  // Recovery time: minutes to close the gap back to guest comfort, scaled by
  // how much colder it is outside than the target (cold days recover slower).
  const outdoor = input.outdoorTempC ?? 8;
  const outdoorFactor = clamp(1 + Math.max(0, 10 - outdoor) * 0.015, 1, 1.6);
  const recoveryMinutes = Math.round(
    Math.abs(input.comfortTempC - setbackC) * input.recoveryRateMinPerDeg * outdoorFactor,
  );

  // Savings vs a flat, building-wide setpoint (see hack brief): a room
  // recommended cooler than the flat baseline saves energy while unoccupied;
  // one recommended warmer (protecting a tight check-in) costs a little back.
  const energyPerDegKwh = (input.uaTotalWPerK * input.unoccupiedHoursPerDay) / 1000;
  const savingsKwhPerDay =
    Math.round(energyPerDegKwh * (FLAT_BASELINE_SETBACK - setbackC) * 10) / 10;
  const flatEnergyKwh = energyPerDegKwh * Math.max(input.comfortTempC - FLAT_BASELINE_SETBACK, 1);
  const savingsPct = Math.round(clamp((savingsKwhPerDay / flatEnergyKwh) * 100, -75, 75));

  // Confidence: physics carries most of the weight; the active signal blend
  // (weighted by the same manager-set weights) adjusts it.
  const activeRows = trace.filter((r) => r.signal.category !== "physics" && r.weight > 0);
  const weightedConfidence = activeRows.reduce(
    (acc, r) => {
      acc.sum += r.weight * r.signal.confidence;
      acc.wt += r.weight;
      return acc;
    },
    { sum: 0, wt: 0 },
  );
  const signalConfidence =
    weightedConfidence.wt > 0 ? weightedConfidence.sum / weightedConfidence.wt : 0.5;
  const confidence = isOverride
    ? 1
    : Math.round(clamp(input.physicsConfidence * 0.6 + signalConfidence * 0.4, 0.3, 0.99) * 100) /
      100;

  return {
    setbackC,
    physicsBaselineC: input.physicsSetbackC,
    recoveryMinutes,
    savingsPct,
    savingsKwhPerDay,
    confidence,
    mode: input.mode,
    reasoningEngine: isOverride ? "override" : input.reasoningEngine,
    ...(input.model ? { model: input.model } : {}),
    narrative: isOverride
      ? `Manual override — AI recommendation was ${aiSetbackC}°C.`
      : input.narrative,
    trace,
    computedAt: new Date().toISOString(),
  };
}
