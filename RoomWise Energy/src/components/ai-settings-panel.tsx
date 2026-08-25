// The AI Settings panel: the primary, minimal "Optimization Output" for a
// room by default (number, confidence, one-line narrative, AI/override
// toggle) — everything else (signal-by-signal reasoning, weights, sensor and
// feedback inputs) lives behind a single "Signals & reasoning" disclosure so
// the room page stays direct at a glance and fully transparent on demand.

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Snowflake,
  Flame,
  Smile,
  FlaskConical,
  X,
} from "lucide-react";
import { getLiveConditions, getBuildingLevels, getFacadeSolar } from "@/lib/live-data.functions";
import type { LiveConditions, BuildingLevels } from "@/lib/live-data";
import type { SolarExposure } from "@/lib/solar-data";
import { ORIENTATION_BEARING } from "@/lib/solar-data";
import type { RoomRecord } from "@/lib/types";
import { runOptimizer } from "@/lib/optimizer/engine";
import { aiReason } from "@/lib/optimizer/reasoner.server";
import { useAiSettings, updateAiSettings } from "@/lib/optimizer/settings";
import {
  useSensorReading,
  setSensorReading,
  useFeedback,
  addFeedback,
  type FeedbackSentiment,
} from "@/lib/optimizer/feedback";
import { DEFAULT_WEIGHT, MAX_WEIGHT, MIN_WEIGHT } from "@/lib/optimizer/types";
import type { OptimizationResult, SignalCategory } from "@/lib/optimizer/types";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface Props {
  room: RoomRecord;
  /** Start with the "Signals & reasoning" detail expanded instead of
   *  collapsed — used on the room page, where the AI recommendation is the
   *  first thing shown and its reasoning should be visible immediately. */
  defaultReasoningOpen?: boolean;
}

const TIER_TONE: Record<number, string> = {
  1: "text-accent-success",
  2: "text-accent-primary",
  3: "text-accent-warn",
};

const CATEGORY_LABEL: Record<SignalCategory, string> = {
  physics: "Physics",
  weather: "Weather",
  solar: "Live solar",
  building: "Building",
  occupancy: "Occupancy",
  "room-learning": "Room learnings",
  sensor: "Room sensor",
  feedback: "Feedback",
};

function confidenceTone(c: number) {
  if (c >= 0.8) return "bg-accent-success";
  if (c >= 0.6) return "bg-accent-primary";
  return "bg-accent-warn";
}

async function fetchHoursToCheckIn(roomId: string): Promise<number | null> {
  const { data } = await supabase
    .from("bookings")
    .select("check_in_at")
    .eq("room_id", roomId)
    .order("check_in_at", { ascending: true });
  const now = Date.now();
  const upcoming = (data ?? [])
    .map((b) => b.check_in_at)
    .filter((t): t is string => !!t && new Date(t).getTime() > now)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const next = upcoming[0];
  if (!next) return null;
  return (new Date(next).getTime() - now) / 3600_000;
}

export function AiSettingsPanel({ room, defaultReasoningOpen = false }: Props) {
  const fetchConditions = useServerFn(getLiveConditions);
  const fetchLevels = useServerFn(getBuildingLevels);
  const fetchSolar = useServerFn(getFacadeSolar);
  const fetchAiReason = useServerFn(aiReason);

  const settings = useAiSettings(room.id);
  const sensorReading = useSensorReading(room.id);
  const feedbackEntries = useFeedback(room.id);

  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(defaultReasoningOpen);
  const [mockOpen, setMockOpen] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState<string>("");
  const [sensorDraft, setSensorDraft] = useState<string>("");
  const [mockDrafts, setMockDrafts] = useState<Record<string, string>>({});
  const lastRequest = useRef<string | null>(null);

  const bearings = Array.from(
    new Set(room.facades.map((f) => ORIENTATION_BEARING[f.orientation]).filter((b) => b >= 0)),
  );

  async function recompute() {
    setComputing(true);
    try {
      const [weather, buildingLevels, solar, hoursToCheckIn] = await Promise.all([
        fetchConditions({ data: { lat: room.lat, lng: room.long, propertySlug: room.propertyId } }),
        fetchLevels({ data: { lat: room.lat, lng: room.long } }),
        bearings.length
          ? fetchSolar({
              data: { lat: room.lat, lng: room.long, bearings, propertySlug: room.propertyId },
            })
          : Promise.resolve<SolarExposure | null>(null),
        fetchHoursToCheckIn(room.id),
      ]);

      const next = await runOptimizer({
        room,
        settings,
        weather: weather as LiveConditions,
        solar,
        buildingLevels: buildingLevels as BuildingLevels,
        hoursToCheckIn,
        bookingKnown: hoursToCheckIn != null,
        sensorReading,
        feedbackEntries,
        llmReason: (args) => fetchAiReason({ data: args }),
      });
      setResult(next);
    } finally {
      setComputing(false);
    }
  }

  useEffect(() => {
    if (!room.lat && !room.long) return;
    const sig = [
      room.id,
      room.lat,
      room.long,
      settings.mode,
      settings.overrideSetpointC,
      JSON.stringify(settings.weights),
      JSON.stringify(settings.calibration),
      JSON.stringify(settings.mockSignals),
      sensorReading?.updatedAt,
      feedbackEntries.length,
    ].join("|");
    if (lastRequest.current === sig) return;
    lastRequest.current = sig;
    void recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    room.id,
    room.lat,
    room.long,
    settings.mode,
    settings.overrideSetpointC,
    settings.weights,
    settings.calibration,
    settings.mockSignals,
    sensorReading,
    feedbackEntries,
  ]);

  const weightedRows = (result?.trace ?? []).filter((r) => r.signal.category !== "physics");
  const baselineRows = (result?.trace ?? []).filter((r) => r.signal.category === "physics");

  function commitOverride() {
    const v = Number(overrideDraft);
    if (!Number.isFinite(v)) return;
    updateAiSettings(room.id, { overrideSetpointC: v });
  }

  function commitSensor() {
    const v = Number(sensorDraft);
    if (!Number.isFinite(v)) return;
    setSensorReading(room.id, v);
    setSensorDraft("");
  }

  // Demo-only: punch a value into a live signal to see how the recommendation
  // reacts — same pipeline as production, see modifiers.ts#mockOverride.
  function commitMock(signalId: string) {
    const v = Number(mockDrafts[signalId]);
    if (!Number.isFinite(v)) return;
    updateAiSettings(room.id, { mockSignals: { ...settings.mockSignals, [signalId]: v } });
  }

  function clearMock(signalId: string) {
    const next = { ...settings.mockSignals };
    delete next[signalId];
    updateAiSettings(room.id, { mockSignals: next });
    setMockDrafts((d) => ({ ...d, [signalId]: "" }));
  }

  const mockedCount = Object.keys(settings.mockSignals).length;
  const mockableRows = weightedRows.filter(
    (r) => r.signal.category !== "sensor" && r.signal.category !== "feedback",
  );

  const deltaC = result ? result.setbackC - result.physicsBaselineC : 0;

  return (
    <section className="bg-accent-primary/10 border border-accent-primary/20 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-accent-primary flex items-center gap-1.5">
          {result?.reasoningEngine === "llm" ? (
            <Sparkles className="size-3.5" />
          ) : (
            <Bot className="size-3.5" />
          )}
          AI Recommendation
        </h2>
        <button
          onClick={() => void recompute()}
          className="text-[10px] font-mono text-data-label hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={cn("size-3", computing && "animate-spin")} />
          {computing ? "THINKING…" : "RECOMPUTE"}
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center justify-between p-3 bg-bg-deep/50 rounded border border-accent-primary/10">
        <span className="text-xs font-medium text-foreground">
          {settings.mode === "ai" ? "AI-recommended" : "Manual override"}
        </span>
        <Switch
          checked={settings.mode === "override"}
          onCheckedChange={(checked) => {
            updateAiSettings(room.id, {
              mode: checked ? "override" : "ai",
              overrideSetpointC: checked
                ? (settings.overrideSetpointC ?? result?.setbackC ?? room.result.setbackC)
                : settings.overrideSetpointC,
            });
          }}
        />
      </div>

      {settings.mode === "override" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            placeholder={String(settings.overrideSetpointC ?? room.result.setbackC)}
            value={overrideDraft}
            onChange={(e) => setOverrideDraft(e.target.value)}
            onBlur={commitOverride}
            onKeyDown={(e) => e.key === "Enter" && commitOverride()}
            className="w-28 bg-bg-deep border border-border-subtle rounded px-3 py-2 text-sm font-mono text-foreground focus:border-accent-primary outline-none"
          />
          <span className="text-[10px] font-mono text-data-label">°C manual setpoint</span>
        </div>
      )}

      {/* Headline number */}
      <div className="space-y-1">
        <div className="text-5xl font-mono text-foreground">
          {result ? result.setbackC : room.result.setbackC}
          <span className="text-lg text-data-label">°C</span>
        </div>
        <div className="text-sm font-medium text-foreground/80">Recommended Setback</div>
        {result && Math.abs(deltaC) > 0.05 && (
          <div className="text-[10px] font-mono text-data-label">
            Physics baseline {result.physicsBaselineC}°C · signals moved it {deltaC > 0 ? "+" : ""}
            {deltaC.toFixed(1)}°C
          </div>
        )}
      </div>

      {result && (
        <>
          <div>
            <div className="flex justify-between text-[10px] font-mono mb-1.5">
              <span className="text-data-label uppercase">Confidence</span>
              <span className="text-foreground">{Math.round(result.confidence * 100)}%</span>
            </div>
            <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
              <div
                className={cn("h-full", confidenceTone(result.confidence))}
                style={{ width: `${Math.round(result.confidence * 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="Recovery time" value={`${result.recoveryMinutes} min`} />
            <Metric
              label="Savings vs flat setpoint"
              value={`${result.savingsKwhPerDay >= 0 ? "" : "−"}${Math.abs(result.savingsKwhPerDay).toFixed(1)} kWh/d (${result.savingsPct}%)`}
            />
          </div>

          <p className="text-[11px] text-foreground/90 leading-relaxed">{result.narrative}</p>
        </>
      )}

      {/* Everything below is the detail view: signals, weights, reasoning */}
      <div className="pt-1 border-t border-accent-primary/10">
        <button
          onClick={() => setDetailsOpen((v) => !v)}
          className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-data-label hover:text-foreground transition-colors pt-3"
        >
          <span>Signals &amp; reasoning</span>
          <ChevronDown
            className={cn("size-3.5 transition-transform", detailsOpen && "rotate-180")}
          />
        </button>

        {detailsOpen && result && (
          <div className="mt-3 space-y-4">
            {result.reasoningEngine !== "override" && (
              <div className="text-[9px] font-mono uppercase text-data-label flex items-center gap-1.5">
                {result.reasoningEngine === "llm" ? (
                  <>
                    <Sparkles className="size-3" /> Reasoned by {result.model ?? "Nebius LLM"}
                  </>
                ) : (
                  <>Rule-based reasoning (no NEBIUS_API_KEY configured)</>
                )}
              </div>
            )}

            {/* Physics baseline, read-only */}
            {baselineRows.map((row) => (
              <div
                key={row.signal.id}
                className="p-2.5 bg-bg-deep/50 rounded border border-border-subtle text-[10px] leading-relaxed"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="text-foreground">
                    {CATEGORY_LABEL[row.signal.category]} · {row.signal.label}
                  </span>
                  <span className="text-data-label">
                    {row.signal.value.toFixed(1)} {row.signal.unit}
                  </span>
                </div>
                {row.signal.detail && <p className="text-data-label mt-1">{row.signal.detail}</p>}
              </div>
            ))}

            {/* Every weighted signal: value, rationale, weight, contribution */}
            {weightedRows.map((row) => {
              const weight = settings.weights[row.signal.id] ?? DEFAULT_WEIGHT;
              return (
                <div
                  key={row.signal.id}
                  className="p-2.5 bg-bg-deep/50 rounded border border-border-subtle space-y-2"
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-foreground">
                      {CATEGORY_LABEL[row.signal.category]} · {row.signal.label}
                      <span className={cn("ml-2", TIER_TONE[row.signal.tier])}>
                        TIER {row.signal.tier}
                      </span>
                    </span>
                    <span className="text-data-label">
                      {row.signal.tier === 3
                        ? "N/A"
                        : `${row.signal.value.toFixed(1)} ${row.signal.unit}`}
                    </span>
                  </div>

                  {row.judgment && (
                    <p className="text-[10px] text-data-label leading-relaxed">
                      {row.judgment.rationale}
                    </p>
                  )}

                  {row.signal.id === "sensor.room_temperature" && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Log reading °C"
                        value={sensorDraft}
                        onChange={(e) => setSensorDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && commitSensor()}
                        className="w-32 bg-bg-deep border border-border-subtle rounded px-2 py-1 text-[10px] font-mono text-foreground focus:border-accent-primary outline-none"
                      />
                      <button
                        onClick={commitSensor}
                        className="text-[9px] font-mono px-2 py-1 border border-border-subtle rounded text-data-label hover:text-foreground transition-colors"
                      >
                        LOG
                      </button>
                    </div>
                  )}

                  {row.signal.id === "feedback.guest_sentiment" && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <FeedbackButton
                          icon={Snowflake}
                          label="Too cold"
                          onClick={() => addFeedback(room.id, "too_cold")}
                        />
                        <FeedbackButton
                          icon={Smile}
                          label="Fine"
                          onClick={() => addFeedback(room.id, "fine")}
                        />
                        <FeedbackButton
                          icon={Flame}
                          label="Too warm"
                          onClick={() => addFeedback(room.id, "too_warm")}
                        />
                      </div>
                      {feedbackEntries.length > 0 && (
                        <div className="text-[9px] font-mono text-data-label">
                          Last:{" "}
                          {feedbackEntries
                            .slice(0, 3)
                            .map((e) => sentimentLabel(e.sentiment))
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-data-label">weight</span>
                      <span className="text-foreground">
                        {weight.toFixed(1)}× · contributes {row.contributionC >= 0 ? "+" : ""}
                        {row.contributionC.toFixed(2)}°C
                      </span>
                    </div>
                    <Slider
                      value={[weight]}
                      min={MIN_WEIGHT}
                      max={MAX_WEIGHT}
                      step={0.1}
                      onValueChange={([v]) => {
                        if (v == null) return;
                        updateAiSettings(room.id, {
                          weights: { ...settings.weights, [row.signal.id]: v },
                        });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Demo-only: override live signal values to see how the recommendation
          reacts, without needing the real weather/solar/OSM feeds to cooperate. */}
      <div className="pt-1 border-t border-accent-primary/10">
        <button
          onClick={() => setMockOpen((v) => !v)}
          className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-data-label hover:text-foreground transition-colors pt-3"
        >
          <span className="flex items-center gap-1.5">
            <FlaskConical className="size-3.5" />
            Mock signal values
            {mockedCount > 0 && <span className="text-accent-warn">({mockedCount} active)</span>}
          </span>
          <ChevronDown className={cn("size-3.5 transition-transform", mockOpen && "rotate-180")} />
        </button>

        {mockOpen && (
          <div className="mt-3 space-y-3">
            <p className="text-[10px] text-data-label leading-relaxed">
              Punch in a value to see how the recommendation reacts — same pipeline as production,
              it just forces the signal to look live. Local to this room, nothing is sent anywhere.
            </p>

            {mockableRows.map((row) => {
              const mocked = settings.mockSignals[row.signal.id];
              const isMocked = mocked !== undefined;
              return (
                <div
                  key={row.signal.id}
                  className="flex items-center justify-between gap-2 p-2.5 bg-bg-deep/50 rounded border border-border-subtle"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-foreground truncate">
                      {CATEGORY_LABEL[row.signal.category]} · {row.signal.label}
                    </div>
                    <div className="text-[9px] font-mono text-data-label">
                      {isMocked ? (
                        <span className="text-accent-warn">
                          Mocked to {mocked} {row.signal.unit}
                        </span>
                      ) : row.signal.tier === 3 ? (
                        "Unavailable"
                      ) : (
                        `Live: ${row.signal.value.toFixed(1)} ${row.signal.unit}`
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      step="0.1"
                      placeholder={isMocked ? String(mocked) : "value"}
                      value={mockDrafts[row.signal.id] ?? ""}
                      onChange={(e) =>
                        setMockDrafts((d) => ({ ...d, [row.signal.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && commitMock(row.signal.id)}
                      className="w-20 bg-surface border border-border-subtle rounded px-2 py-1 text-[10px] font-mono text-foreground focus:border-accent-primary outline-none"
                    />
                    <button
                      onClick={() => commitMock(row.signal.id)}
                      className="text-[9px] font-mono px-2 py-1 border border-border-subtle rounded text-data-label hover:text-foreground transition-colors"
                    >
                      SET
                    </button>
                    {isMocked && (
                      <button
                        onClick={() => clearMock(row.signal.id)}
                        title="Back to live"
                        className="p-1 rounded text-data-label hover:text-accent-warn transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function sentimentLabel(s: FeedbackSentiment) {
  return s === "too_cold" ? "too cold" : s === "too_warm" ? "too warm" : "fine";
}

function FeedbackButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Snowflake;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1 text-[9px] font-mono px-2 py-1.5 border border-border-subtle rounded text-data-label hover:text-foreground hover:border-accent-primary transition-colors"
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-bg-deep/50 rounded border border-accent-primary/10">
      <div className="text-[9px] font-mono text-data-label uppercase">{label}</div>
      <div className="text-sm font-mono text-foreground mt-0.5">{value}</div>
    </div>
  );
}
