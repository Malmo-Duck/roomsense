// Deterministic stand-in for the AI reasoning step — same output contract as
// the LLM path (reasoner.server.ts), zero latency, zero setup. This is what
// runs whenever the LLM path is unavailable or unconfigured, which is the
// default until a NEBIUS_API_KEY is set: the demo never goes dark, it only
// loses the "explained in the model's own words" narrative.

import type { AiJudgment, SignalReading } from "./types";

export interface RuleBasedResult {
  judgments: AiJudgment[];
  narrative: string;
}

export function ruleBasedReason(signals: SignalReading[]): RuleBasedResult {
  const judgments: AiJudgment[] = signals.map((s) => {
    if (s.category === "physics") {
      return {
        signalId: s.id,
        directionC: 0,
        confidence: s.confidence,
        rationale: "Already reflected in the physics baseline setback.",
      };
    }
    if (s.tier === 3) {
      return {
        signalId: s.id,
        directionC: 0,
        confidence: 0,
        rationale: "Unavailable — no adjustment applied, excluded from the blend.",
      };
    }
    return judgeOne(s);
  });

  const active = judgments.filter((j) => j.confidence > 0 && Math.abs(j.directionC) > 0.03);
  const narrative = active.length
    ? `Rule-based read: ${active
        .map(
          (j) => `${labelOf(j.signalId)} ${j.directionC > 0 ? "pushes warmer" : "pushes cooler"}`,
        )
        .join(", ")}.`
    : "Rule-based read: no live signal pushed materially off the physics baseline.";

  return { judgments, narrative };
}

function labelOf(signalId: string) {
  return signalId.split(".")[1]?.replace(/_/g, " ") ?? signalId;
}

function judgeOne(s: SignalReading): AiJudgment {
  switch (s.id) {
    case "weather.outdoor_temp": {
      const directionC = clamp((5 - s.value) * 0.03, -0.5, 0.8);
      return {
        signalId: s.id,
        directionC,
        confidence: s.confidence,
        rationale:
          directionC > 0.05
            ? `Cold outside (${s.value.toFixed(1)}°C) — losses run faster, keep a slightly warmer margin.`
            : directionC < -0.05
              ? `Mild outside (${s.value.toFixed(1)}°C) — a cooler setback still recovers comfortably.`
              : "Outdoor temperature is close to neutral for this room.",
      };
    }
    case "weather.cloud_cover": {
      const directionC = clamp((s.value / 100 - 0.5) * 0.8, -0.4, 0.4);
      return {
        signalId: s.id,
        directionC,
        confidence: s.confidence,
        rationale:
          directionC < -0.05
            ? `Low cloud cover (${Math.round(s.value)}%) — expect free solar heat.`
            : directionC > 0.05
              ? `Overcast (${Math.round(s.value)}%) — don't count on solar gain today.`
              : "Cloud cover is roughly average.",
      };
    }
    case "solar.irradiance": {
      const directionC = clamp(-s.value / 2000, -0.6, 0);
      return {
        signalId: s.id,
        directionC,
        confidence: s.confidence,
        rationale:
          directionC < -0.05
            ? `Strong live irradiance (${Math.round(s.value)} W/m²) beyond the static model — room to go cooler.`
            : "Live irradiance is in line with the static model.",
      };
    }
    case "building.levels": {
      return {
        signalId: s.id,
        directionC: 0,
        confidence: s.confidence,
        rationale: "Confirms the floor-position assumption; doesn't move the setpoint on its own.",
      };
    }
    case "occupancy.hours_to_checkin": {
      const directionC = clamp(1.2 - s.value * 0.15, -0.6, 1.0);
      return {
        signalId: s.id,
        directionC,
        confidence: s.confidence,
        rationale:
          directionC > 0.1
            ? `Check-in in ${s.value.toFixed(1)} h — stay close to comfort to guarantee recovery in time.`
            : `Check-in in ${s.value.toFixed(1)} h — plenty of runway for a deeper setback.`,
      };
    }
    case "room_learning.recovery_rate": {
      const directionC = clamp((s.value - 15) * 0.04, -0.5, 0.9);
      return {
        signalId: s.id,
        directionC,
        confidence: s.confidence,
        rationale:
          directionC > 0.05
            ? `Slow to recover (${s.value.toFixed(1)} min/°C) — needs a warmer safety margin.`
            : `Recovers quickly (${s.value.toFixed(1)} min/°C) — tolerates a deeper setback.`,
      };
    }
    case "sensor.room_temperature": {
      // s.value = actual - target, °C. Negative = colder than target (behind on recovery).
      const directionC = clamp(-s.value * 0.5, -0.8, 0.8);
      return {
        signalId: s.id,
        directionC,
        confidence: s.confidence,
        rationale:
          directionC > 0.05
            ? `Sensor reads ${Math.abs(s.value).toFixed(1)}°C colder than target — give recovery more margin.`
            : directionC < -0.05
              ? `Sensor reads ${Math.abs(s.value).toFixed(1)}°C warmer than target — tracking ahead, room to go deeper.`
              : "Sensor is tracking the target closely.",
      };
    }
    case "feedback.guest_sentiment": {
      // s.value in [-1, 1]: +1 = all "too cold" reports, -1 = all "too warm".
      const directionC = clamp(s.value * 0.9, -0.9, 0.9);
      return {
        signalId: s.id,
        directionC,
        confidence: s.confidence,
        rationale:
          directionC > 0.1
            ? "Recent reports lean 'too cold' — recovering guests colder than they expect."
            : directionC < -0.1
              ? "Recent reports lean 'too warm' — safe to run the setback deeper."
              : "Recent reports are mixed or neutral.",
      };
    }
    default:
      return {
        signalId: s.id,
        directionC: 0,
        confidence: s.confidence,
        rationale: "No rule defined for this signal yet.",
      };
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
