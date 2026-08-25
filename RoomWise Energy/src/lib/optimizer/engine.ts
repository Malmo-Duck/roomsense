// Orchestrates the full pipeline: collect signals -> apply modifiers -> AI
// reasoning (Nebius-hosted LLM if configured, rule-based fallback otherwise)
// -> the deterministic, weight-driven combiner -> a result the UI can render
// as-is. This is the one function the room detail page calls.

import type { RoomRecord } from "../types";
import type { LiveConditions, BuildingLevels } from "../live-data";
import type { SolarExposure } from "../solar-data";
import type { FeedbackEntry, RoomSensorReading } from "./feedback";
import { collectSignals } from "./signals";
import { applyModifiers } from "./modifiers";
import { ruleBasedReason } from "./reasoner";
import { combine } from "./combine";
import type {
  AiJudgment,
  AiSettings,
  OptimizationResult,
  ReasoningEngine,
  SignalReading,
} from "./types";

export interface RunOptimizerInput {
  room: Pick<RoomRecord, "label" | "floorNumber" | "totalLevels" | "result">;
  settings: AiSettings;
  weather: LiveConditions | null;
  solar: SolarExposure | null;
  buildingLevels: BuildingLevels | null;
  hoursToCheckIn: number | null;
  bookingKnown: boolean;
  sensorReading: RoomSensorReading | null;
  feedbackEntries: FeedbackEntry[];
  /** Injected so engine.ts stays a plain function callable from client or
   *  server code without importing a TanStack server fn at module scope. */
  llmReason?: (args: {
    signals: SignalReading[];
    room: { label: string; floorNumber: number; totalLevels: number };
  }) => Promise<{ available: boolean; judgments: AiJudgment[]; narrative: string; model?: string }>;
}

const COMFORT_TEMP_C = 21;
const UNOCCUPIED_HOURS_PER_DAY = 20;

export async function runOptimizer(input: RunOptimizerInput): Promise<OptimizationResult> {
  const physics = input.room.result;

  const rawSignals = collectSignals({
    physics,
    weather: input.weather,
    solar: input.solar,
    buildingLevels: input.buildingLevels,
    hoursToCheckIn: input.hoursToCheckIn,
    bookingKnown: input.bookingKnown,
    sensorReading: input.sensorReading,
    feedbackEntries: input.feedbackEntries,
  });
  const signals = applyModifiers(rawSignals, {
    calibration: input.settings.calibration,
    mockSignals: input.settings.mockSignals,
  });

  let judgments: AiJudgment[];
  let narrative: string;
  let reasoningEngine: ReasoningEngine = "rule-based";
  let model: string | undefined;

  const llm = await input.llmReason?.({
    signals,
    room: {
      label: input.room.label,
      floorNumber: input.room.floorNumber,
      totalLevels: input.room.totalLevels,
    },
  });

  if (llm?.available && llm.judgments.length) {
    judgments = llm.judgments;
    narrative = llm.narrative;
    reasoningEngine = "llm";
    model = llm.model;
  } else {
    const ruleBased = ruleBasedReason(signals);
    judgments = ruleBased.judgments;
    narrative = ruleBased.narrative;
  }

  const recoveryRateSignal = signals.find((s) => s.id === "room_learning.recovery_rate");
  const outdoorSignal = signals.find((s) => s.id === "weather.outdoor_temp");

  return combine({
    physicsSetbackC: physics.setbackC,
    physicsConfidence: physics.confidence,
    uaTotalWPerK: physics.uaTotal,
    outdoorTempC: outdoorSignal && outdoorSignal.tier !== 3 ? outdoorSignal.value : null,
    recoveryRateMinPerDeg: recoveryRateSignal?.value ?? 15,
    comfortTempC: COMFORT_TEMP_C,
    unoccupiedHoursPerDay: UNOCCUPIED_HOURS_PER_DAY,
    signals,
    judgments,
    weights: input.settings.weights,
    mode: input.settings.mode,
    overrideSetpointC: input.settings.overrideSetpointC,
    narrative,
    reasoningEngine,
    ...(model ? { model } : {}),
  });
}
