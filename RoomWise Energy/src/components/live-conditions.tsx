import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CloudSun, Building2, RefreshCw } from "lucide-react";
import { getLiveConditions, getBuildingLevels } from "@/lib/live-data.functions";
import { nowIndex, type BuildingLevels, type LiveConditions } from "@/lib/live-data";
import { cn } from "@/lib/utils";

interface Props {
  lat: number;
  long: number;
  propertySlug?: string;
  onLevels?: (levels: number) => void;
}

const TIER_TONE: Record<number, string> = {
  1: "text-accent-success",
  2: "text-accent-primary",
  3: "text-accent-warn",
};

export function LiveConditionsPanel({ lat, long, propertySlug, onLevels }: Props) {
  const fetchConditions = useServerFn(getLiveConditions);
  const fetchLevels = useServerFn(getBuildingLevels);

  const [conditions, setConditions] = useState<LiveConditions | null>(null);
  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState<BuildingLevels | null>(null);
  const [levelsLoading, setLevelsLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchConditions({
        data: { lat, lng: long, ...(propertySlug ? { propertySlug } : {}) },
      });
      setConditions(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!lat && !long) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, long, propertySlug]);

  async function detectLevels() {
    setLevelsLoading(true);
    try {
      const res = await fetchLevels({ data: { lat, lng: long } });
      setLevels(res);
      if (res.levels && onLevels) onLevels(res.levels);
    } finally {
      setLevelsLoading(false);
    }
  }

  const w = conditions?.weather;
  const i = w ? nowIndex(w) : 0;
  const temp = w?.temperatureC?.[i];
  const cloud = w?.cloudCoverPct?.[i];

  return (
    <section className="bg-surface border border-border-subtle rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-data-label">
          Live Conditions
        </h2>
        <button
          onClick={() => void load()}
          className="text-[10px] font-mono text-data-label hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          REFRESH
        </button>
      </div>

      <div className="flex items-start gap-4">
        <CloudSun className="size-5 text-accent-primary mt-1" />
        <div className="flex-1">
          {temp !== undefined ? (
            <>
              <div className="text-3xl font-mono text-foreground">
                {temp.toFixed(1)}
                <span className="text-sm text-data-label">°C</span>
              </div>
              <div className="text-[10px] font-mono text-data-label mt-1">
                Cloud cover {Math.round(cloud ?? 0)}% · Open-Meteo · {w?.timezone}
              </div>
            </>
          ) : (
            <div className="text-sm text-data-label">
              {loading ? "Fetching…" : "Outdoor temperature unavailable"}
            </div>
          )}
          {conditions && (
            <div className={cn("text-[10px] font-mono mt-2", TIER_TONE[conditions.tier])}>
              TIER {conditions.tier} · {conditions.source.toUpperCase()}
              {conditions.fetchedAt
                ? ` · ${new Date(conditions.fetchedAt).toLocaleTimeString()}`
                : ""}
              {conditions.error ? ` · ${conditions.error}` : ""}
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-border-subtle space-y-3">
        <div className="flex items-start gap-4">
          <Building2 className="size-5 text-accent-primary mt-1" />
          <div className="flex-1">
            <div className="text-[10px] font-mono text-data-label uppercase">
              OSM building levels
            </div>
            <div className="text-sm text-foreground mt-1">
              {levels?.levels
                ? `${levels.levels} levels${levels.name ? ` · ${levels.name}` : ""}`
                : levels
                  ? (levels.error ?? "Not found")
                  : "Not looked up yet"}
            </div>
            {levels && (
              <div className={cn("text-[10px] font-mono mt-1", TIER_TONE[levels.tier])}>
                TIER {levels.tier}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => void detectLevels()}
          disabled={levelsLoading}
          className="w-full text-[10px] font-mono px-3 py-2 border border-border-subtle rounded text-data-label hover:text-foreground hover:border-accent-primary transition-colors disabled:opacity-50"
        >
          {levelsLoading ? "QUERYING OVERPASS…" : "DETECT TOTAL LEVELS FROM OSM"}
        </button>
      </div>
    </section>
  );
}
