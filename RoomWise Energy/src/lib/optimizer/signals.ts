// Signal sources: normalizes every feed the optimizer knows about into the
// common SignalReading shape. Each source degrades to a tier-3 "unavailable"
// reading instead of throwing, so a missing feed never blocks a recommendation
// — it just drops out of the AI/deterministic blend with zero confidence.

import type { SetbackResult } from "../types";
import type { LiveConditions, BuildingLevels } from "../live-data";
import { nowIndex } from "../live-data";
import type { SolarExposure } from "../solar-data";
import type { FeedbackEntry, RoomSensorReading } from "./feedback";
import { isSensorFresh, sentimentScore } from "./feedback";
import type { SignalCategory, SignalReading } from "./types";

export interface CollectInput {
  physics: SetbackResult;
  weather: LiveConditions | null;
  solar: SolarExposure | null;
  buildingLevels: BuildingLevels | null;
  /** Hours until the room's next booked check-in, if a calendar exists. */
  hoursToCheckIn: number | null;
  bookingKnown: boolean;
  /** Live/synthetic thermostat reading — the room-sensor signal. */
  sensorReading: RoomSensorReading | null;
  /** Guest/staff "too cold" / "too warm" reports — the feedback signal. */
  feedbackEntries: FeedbackEntry[];
}

function unavailable(
  id: string,
  label: string,
  category: SignalCategory,
  unit: string,
): SignalReading {
  return {
    id,
    label,
    category,
    value: 0,
    unit,
    tier: 3,
    confidence: 0,
    detail: "Unavailable — degraded gracefully, excluded from the blend.",
    asOf: null,
  };
}

/** Minutes to recover 1°C, from envelope leakiness + a nominal thermal mass.
 *  Placeholder "room learning" signal: today it's derived from geometry, but
 *  it's designed to be replaced by a real reheat-history estimator once a
 *  property has logged enough setback -> recovery observations. */
function estimateRecoveryRate(physics: SetbackResult): number {
  const massMinutes = 9; // nominal min/°C for a well-sealed hotel room
  const leakPenalty = Math.max(0, physics.uaDensity - 1.8) * 2.2;
  return Math.round((massMinutes + leakPenalty) * 10) / 10;
}

export function collectSignals(input: CollectInput): SignalReading[] {
  const signals: SignalReading[] = [];

  // --- Physics baseline: shown for transparency, never weighted/nudged ---
  signals.push({
    id: "physics.envelope",
    label: "Building envelope (UA density)",
    category: "physics",
    value: input.physics.uaDensity,
    unit: "W/K·m²",
    tier: 1,
    confidence: input.physics.confidence,
    detail: `${input.physics.uaTotal.toFixed(0)} W/K across ${input.physics.footprint.toFixed(0)} m² footprint.`,
    asOf: null,
  });
  signals.push({
    id: "physics.solar_model",
    label: "Modelled solar gain (static)",
    category: "physics",
    value: input.physics.solarPeakW,
    unit: "W peak",
    tier: 1,
    confidence: input.physics.confidence,
    detail: "Clear-sky equinox model from facade orientation and glazing.",
    asOf: null,
  });

  // --- Weather ---
  if (input.weather?.weather) {
    const idx = nowIndex(input.weather.weather);
    const tier = input.weather.tier;
    signals.push({
      id: "weather.outdoor_temp",
      label: "Outdoor temperature",
      category: "weather",
      value: input.weather.weather.temperatureC[idx] ?? 10,
      unit: "°C",
      tier,
      confidence: tier === 1 ? 0.9 : tier === 2 ? 0.6 : 0.3,
      detail: `Open-Meteo, ${input.weather.source}.`,
      asOf: input.weather.fetchedAt,
    });
    signals.push({
      id: "weather.cloud_cover",
      label: "Cloud cover",
      category: "weather",
      value: input.weather.weather.cloudCoverPct[idx] ?? 50,
      unit: "%",
      tier,
      confidence: tier === 1 ? 0.85 : tier === 2 ? 0.55 : 0.3,
      detail: "Governs how much of the modelled solar gain lands today.",
      asOf: input.weather.fetchedAt,
    });
  } else {
    signals.push(unavailable("weather.outdoor_temp", "Outdoor temperature", "weather", "°C"));
    signals.push(unavailable("weather.cloud_cover", "Cloud cover", "weather", "%"));
  }

  // --- Live solar (PVGIS), independent of the static orientation model ---
  if (input.solar?.facades.length) {
    const peak = Math.max(...input.solar.facades.map((f) => f.peakWM2));
    signals.push({
      id: "solar.irradiance",
      label: "Live solar irradiance (PVGIS)",
      category: "solar",
      value: peak,
      unit: "W/m²",
      tier: input.solar.tier,
      confidence: input.solar.tier === 1 ? 0.85 : input.solar.tier === 2 ? 0.55 : 0.3,
      detail: `Strongest facade, ${input.solar.source}.`,
      asOf: input.solar.fetchedAt,
    });
  } else {
    signals.push(unavailable("solar.irradiance", "Live solar irradiance", "solar", "W/m²"));
  }

  // --- Building context (confirms floor position; no direction of its own) ---
  if (input.buildingLevels?.levels) {
    signals.push({
      id: "building.levels",
      label: "Building height (OSM)",
      category: "building",
      value: input.buildingLevels.levels,
      unit: "levels",
      tier: input.buildingLevels.tier,
      confidence: 0.7,
      detail: input.buildingLevels.name ?? "Nearest OSM building footprint.",
      asOf: null,
    });
  } else {
    signals.push(unavailable("building.levels", "Building height (OSM)", "building", "levels"));
  }

  // --- Occupancy ---
  if (input.bookingKnown && input.hoursToCheckIn != null) {
    signals.push({
      id: "occupancy.hours_to_checkin",
      label: "Hours to next check-in",
      category: "occupancy",
      value: input.hoursToCheckIn,
      unit: "h",
      tier: 1,
      confidence: 0.9,
      detail: "From the room's booking calendar.",
      asOf: null,
    });
  } else {
    signals.push(
      unavailable("occupancy.hours_to_checkin", "Hours to next check-in", "occupancy", "h"),
    );
  }

  // --- Room learning ---
  signals.push({
    id: "room_learning.recovery_rate",
    label: "Room learnings: recovery rate",
    category: "room-learning",
    value: estimateRecoveryRate(input.physics),
    unit: "min/°C",
    tier: 2,
    confidence: 0.5,
    detail: "Estimated from envelope + thermal mass; sharpens once reheat history is logged.",
    asOf: null,
  });

  // --- Room sensor: actual reading vs. the physics target ---
  if (input.sensorReading) {
    const deviation = input.sensorReading.temperatureC - input.physics.setbackC;
    const fresh = isSensorFresh(input.sensorReading);
    signals.push({
      id: "sensor.room_temperature",
      label: "Room sensor: actual vs. target",
      category: "sensor",
      value: deviation,
      unit: "°C from target",
      tier: fresh ? 1 : 2,
      confidence: fresh ? 0.85 : 0.4,
      detail: `Reads ${input.sensorReading.temperatureC.toFixed(1)}°C, target ${input.physics.setbackC}°C.`,
      asOf: input.sensorReading.updatedAt,
    });
  } else {
    signals.push(
      unavailable(
        "sensor.room_temperature",
        "Room sensor: actual vs. target",
        "sensor",
        "°C from target",
      ),
    );
  }

  // --- Guest/staff feedback ---
  const sentiment = sentimentScore(input.feedbackEntries);
  if (sentiment != null) {
    signals.push({
      id: "feedback.guest_sentiment",
      label: "Guest/staff feedback",
      category: "feedback",
      value: sentiment,
      unit: "net score (-1 warm .. +1 cold)",
      tier: 1,
      confidence: 0.6,
      detail: `From the last 7 days of reports (${input.feedbackEntries.length} logged total).`,
      asOf: input.feedbackEntries[0]?.createdAt ?? null,
    });
  } else {
    signals.push(
      unavailable("feedback.guest_sentiment", "Guest/staff feedback", "feedback", "net score"),
    );
  }

  return signals;
}
