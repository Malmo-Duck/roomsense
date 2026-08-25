// Real AI reasoning over a room's signals, via Nebius Token Factory (OpenAI-
// compatible inference, paid for with the team's Nebius credits) — server-
// only so the API key never reaches the browser. Same output contract as
// reasoner.ts (rule-based), so the client can swap between them without
// knowing which one ran. Returns `available: false` (no network call at all)
// when no key is configured, so the demo falls back to the rule-based
// reasoner instantly instead of stalling on a request that can't succeed —
// the "AI" source itself degrades gracefully, same as every other signal.

import { createServerFn } from "@tanstack/react-start";
import OpenAI from "openai";
import type { AiJudgment, SignalReading } from "./types";

const NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";
// Qwen3 235B is Nebius's own JSON-mode example model — a strong general
// instruct model with good structured-output reliability. Override with
// NEBIUS_MODEL if your account prefers a different one (DeepSeek-R1,
// Llama-3.3-70B-Instruct, etc. are all live options on the platform).
const DEFAULT_MODEL = "Qwen/Qwen3-235B-A22B";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    judgments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          signalId: { type: "string" },
          directionC: { type: "number" },
          confidence: { type: "number" },
          rationale: { type: "string" },
        },
        required: ["signalId", "directionC", "confidence", "rationale"],
        additionalProperties: false,
      },
    },
    narrative: { type: "string" },
  },
  required: ["judgments", "narrative"],
  additionalProperties: false,
} as const;

export interface LlmReasoningResult {
  available: boolean;
  judgments: AiJudgment[];
  narrative: string;
  model?: string;
  error?: string;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Defensive parse: an LLM can return a technically-valid-JSON payload that
 *  still drifts outside the ranges we asked for. Never trust it further than
 *  "shape is right" — clamp every number before it reaches the combiner. */
function parseReasoning(raw: unknown): { judgments: AiJudgment[]; narrative: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { judgments?: unknown; narrative?: unknown };
  if (!Array.isArray(obj.judgments) || typeof obj.narrative !== "string") return null;

  const judgments: AiJudgment[] = [];
  for (const j of obj.judgments) {
    if (!j || typeof j !== "object") continue;
    const row = j as Record<string, unknown>;
    if (typeof row["signalId"] !== "string") continue;
    judgments.push({
      signalId: row["signalId"],
      directionC: clamp(Number(row["directionC"]) || 0, -1.5, 1.5),
      confidence: clamp(Number(row["confidence"]) || 0, 0, 1),
      rationale: typeof row["rationale"] === "string" ? row["rationale"].slice(0, 220) : "",
    });
  }
  return { judgments, narrative: obj.narrative.slice(0, 400) };
}

export const aiReason = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      signals: SignalReading[];
      room: { label: string; floorNumber: number; totalLevels: number };
    }) => d,
  )
  .handler(async ({ data }): Promise<LlmReasoningResult> => {
    const apiKey = process.env["NEBIUS_API_KEY"];
    if (!apiKey) return { available: false, judgments: [], narrative: "" };

    const model = process.env["NEBIUS_MODEL"] || DEFAULT_MODEL;
    const signalLines = data.signals
      .filter((s) => s.category !== "physics")
      .map(
        (s) =>
          `- ${s.id} (${s.label}): ${s.value} ${s.unit}, tier ${s.tier} (1=live, 2=stale/cached, 3=unavailable), source confidence ${s.confidence}. ${s.detail ?? ""}`,
      )
      .join("\n");

    try {
      const client = new OpenAI({ apiKey, baseURL: NEBIUS_BASE_URL });
      const completion = await client.chat.completions.create({
        model,
        response_format: {
          type: "json_schema",
          json_schema: { name: "roomwise_reasoning", schema: RESPONSE_SCHEMA, strict: true },
        },
        messages: [
          {
            role: "system",
            content:
              "You are the reasoning layer inside a hotel HVAC setback optimizer. For each " +
              "listed signal, judge how far it should nudge the room's unoccupied setback " +
              "temperature away from its already-computed physics baseline: positive directionC " +
              "means warmer/safer (protects comfort recovery before check-in), negative means " +
              "cooler (more energy savings). Stay within [-1.5, 1.5] deg C per signal, and be " +
              "conservative — most signals should nudge by well under 1 degree, physics already " +
              "does the heavy lifting. A tier-3 (unavailable) signal must get directionC 0 and " +
              "confidence 0. One plain-language sentence of rationale per signal, plus a " +
              "two-sentence overall narrative a hotel operations manager can read at a glance. " +
              "Respond with JSON only, matching the given schema.",
          },
          {
            role: "user",
            content: `Room: ${data.room.label}, floor ${data.room.floorNumber} of ${data.room.totalLevels}.\n\nSignals:\n${signalLines}`,
          },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return {
          available: false,
          judgments: [],
          narrative: "",
          error: "Empty response from Nebius.",
        };
      }
      const parsed = parseReasoning(JSON.parse(content));
      if (!parsed || !parsed.judgments.length) {
        return {
          available: false,
          judgments: [],
          narrative: "",
          error: "Nebius response did not match the expected schema.",
        };
      }
      return { available: true, judgments: parsed.judgments, narrative: parsed.narrative, model };
    } catch (err) {
      return {
        available: false,
        judgments: [],
        narrative: "",
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  });
