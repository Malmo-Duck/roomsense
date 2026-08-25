import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sun, RefreshCw, EyeOff } from "lucide-react";
import { getFacadeSolar } from "@/lib/live-data.functions";
import {
  ORIENTATION_BEARING,
  SHADING_DISCLAIMER,
  type SolarExposure,
} from "@/lib/solar-data";
import type { Orientation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  lat: number;
  long: number;
  orientations: Orientation[];
  propertySlug?: string;
}

const TIER_TONE: Record<number, string> = {
  1: "text-accent-success",
  2: "text-accent-primary",
  3: "text-accent-warn",
};

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function labelFor(bearing: number): string {
  const hit = (Object.entries(ORIENTATION_BEARING) as [Orientation, number][]).find(
    ([, b]) => b === bearing,
  );
  return hit ? hit[0] : `${bearing}°`;
}

export function SolarExposurePanel({ lat, long, orientations, propertySlug }: Props) {
  const fetchSolar = useServerFn(getFacadeSolar);
  const [data, setData] = useState<SolarExposure | null>(null);
  const [loading, setLoading] = useState(false);
  // StrictMode double-invokes effects; without this each facade is fetched twice.
  const lastRequest = useRef<string | null>(null);

  const bearings = Array.from(
    new Set(
      orientations
        .map((o) => ORIENTATION_BEARING[o])
        .filter((b) => b >= 0),
    ),
  );
  const key = bearings.join(",");

  async function load() {
    if (bearings.length === 0) return;
    setLoading(true);
    try {
      const res = await fetchSolar({
        data: {
          lat,
          lng: long,
          bearings,
          ...(propertySlug ? { propertySlug } : {}),
        },
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!lat && !long) return;
    const sig = `${lat}|${long}|${key}|${propertySlug ?? ""}`;
    if (lastRequest.current === sig) return;
    lastRequest.current = sig;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, long, key, propertySlug]);

  const month = new Date().getMonth();
  const maxMonthly = Math.max(
    1,
    ...(data?.facades.flatMap((f) => f.monthlyKWhM2) ?? [1]),
  );

  return (
    <section className="bg-surface border border-border-subtle rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-data-label">
          Facade Solar · PVGIS
        </h2>
        <button
          onClick={() => void load()}
          className="text-[10px] font-mono text-data-label hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          REFRESH
        </button>
      </div>

      {!data && (
        <div className="flex items-center gap-2 text-sm text-data-label">
          <Sun className="size-4 text-accent-primary" />
          {loading ? "Querying PVGIS…" : "No exterior facades to evaluate."}
        </div>
      )}

      {data?.facades.map((f) => (
        <div key={f.bearingDeg} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-foreground">
              {labelFor(f.bearingDeg)} facade
              <span className="text-[10px] font-mono text-data-label ml-2">
                {f.bearingDeg}° · aspect {f.aspectDeg}°
              </span>
            </span>
            <span className="text-sm font-mono text-foreground">
              {Math.round(f.peakWM2)}
              <span className="text-[10px] text-data-label"> W/m² peak</span>
            </span>
          </div>
          <div className="flex items-end gap-[3px] h-10">
            {f.monthlyKWhM2.map((v, i) => (
              <div
                key={i}
                title={`${MONTHS[i]}: ${v.toFixed(1)} kWh/m²`}
                className={cn(
                  "flex-1 rounded-sm",
                  i === month ? "bg-accent-primary" : "bg-accent-primary/25",
                )}
                style={{ height: `${Math.max(6, (v / maxMonthly) * 100)}%` }}
              />
            ))}
          </div>
          <div className="text-[10px] font-mono text-data-label">
            {f.todayKWhM2.toFixed(2)} kWh/m²·day this month (in-plane, vertical)
          </div>
        </div>
      ))}

      {data && (
        <div className={cn("text-[10px] font-mono", TIER_TONE[data.tier])}>
          TIER {data.tier} · {data.source.toUpperCase()}
          {data.error ? ` · ${data.error}` : ""}
          {data.fetchedAt
            ? ` · ${new Date(data.fetchedAt).toISOString().slice(0, 16).replace("T", " ")}Z`
            : ""}
        </div>
      )}

      <div className="flex gap-2 p-3 bg-bg-deep/60 rounded border border-accent-warn/20">
        <EyeOff className="size-3.5 text-accent-warn shrink-0 mt-0.5" />
        <p className="text-[10px] text-data-label leading-relaxed">
          <span className="text-accent-warn font-medium">Assumed unshaded. </span>
          {SHADING_DISCLAIMER}
        </p>
      </div>
    </section>
  );
}
