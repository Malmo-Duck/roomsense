// Live external data feeds (server-side, cached in Lovable Cloud):
//  - Open-Meteo  → outdoor temperature + cloud cover (hourly, next 48 h)
//  - OSM Overpass → building:levels for the nearest building footprint
//
// Both run server-side so no CORS surprises on demo day, and weather responses
// are cached in `weather_cache` for graceful degradation when a fetch fails.

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { LiveConditions, BuildingLevels, HourlyWeather } from "./live-data";
import { compassToAspect } from "./solar-data";
import type { FacadeSolar, SolarExposure } from "./solar-data";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

function serverClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function fetchOpenMeteo(lat: number, lng: number): Promise<HourlyWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&hourly=temperature_2m,cloud_cover&forecast_days=2&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = (await res.json()) as {
    timezone: string;
    hourly: { time: string[]; temperature_2m: number[]; cloud_cover: number[] };
  };
  return {
    timezone: json.timezone,
    time: json.hourly.time,
    temperatureC: json.hourly.temperature_2m,
    cloudCoverPct: json.hourly.cloud_cover,
  };
}

/** Outdoor temp + cloud cover for a property, cached in the database. */
export const getLiveConditions = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number; propertySlug?: string }) => d)
  .handler(async ({ data }): Promise<LiveConditions> => {
    const supabase = serverClient();

    let propertyId: string | null = null;
    if (data.propertySlug) {
      const { data: prop } = await supabase
        .from("properties")
        .select("id")
        .eq("slug", data.propertySlug)
        .maybeSingle();
      propertyId = prop?.id ?? null;
    }

    let cached: { hourly_json: unknown; fetched_at: string } | null = null;
    if (propertyId) {
      const { data: row } = await supabase
        .from("weather_cache")
        .select("hourly_json, fetched_at")
        .eq("property_id", propertyId)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      cached = row ?? null;
      if (row && Date.now() - new Date(row.fetched_at).getTime() < CACHE_TTL_MS) {
        return {
          tier: 1,
          source: "cache",
          fetchedAt: row.fetched_at,
          weather: row.hourly_json as unknown as HourlyWeather,
        };
      }
    }

    try {
      const weather = await fetchOpenMeteo(data.lat, data.lng);
      const fetchedAt = new Date().toISOString();
      if (propertyId) {
        await supabase.from("weather_cache").insert({
          property_id: propertyId,
          fetched_at: fetchedAt,
          hourly_json: weather as unknown as never,
        });
      }
      return { tier: 1, source: "live", fetchedAt, weather };
    } catch (err) {
      if (cached) {
        return {
          tier: 2,
          source: "stale-cache",
          fetchedAt: cached.fetched_at,
          weather: cached.hourly_json as unknown as HourlyWeather,
        };
      }
      return {
        tier: 3,
        source: "unavailable",
        fetchedAt: null,
        weather: null,
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  });

/** Nearest OSM building footprint's `building:levels` tag. */
export const getBuildingLevels = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number }) => d)
  .handler(async ({ data }): Promise<BuildingLevels> => {
    const q = `[out:json][timeout:20];(way["building"](around:60,${data.lat},${data.lng});relation["building"](around:60,${data.lat},${data.lng}););out tags center 10;`;
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as {
        elements: Array<{
          tags?: Record<string, string>;
          center?: { lat: number; lon: number };
        }>;
      };
      for (const el of json.elements ?? []) {
        const raw = el.tags?.["building:levels"];
        const levels = raw ? Number.parseInt(raw, 10) : NaN;
        if (Number.isFinite(levels) && levels > 0) {
          return {
            tier: 1,
            levels,
            name: el.tags?.["name"] ?? el.tags?.["addr:street"] ?? null,
          };
        }
      }
      return { tier: 2, levels: null, name: null, error: "No building:levels tag nearby" };
    } catch (err) {
      return {
        tier: 3,
        levels: null,
        name: null,
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  });

// --- PVGIS: per-facade plane-of-array irradiation ---------------------------
// MRcalc returns monthly in-plane irradiation (kWh/m²) for a fixed plane.
// Vertical wall → angle=90; aspect uses PVGIS's 0 = south convention.

const SOLAR_TTL_MS = 30 * 24 * 60 * 60 * 1000; // climatology: refresh monthly

async function fetchPvgisMonthly(
  lat: number,
  lng: number,
  aspect: number,
  tilt: number,
): Promise<number[]> {
  // PVcalc (not MRcalc — that endpoint ignores `aspect`) returns the monthly
  // long-term average in-plane irradiation H(i)_m for a fixed plane, so each
  // facade orientation gets its own series. PVGIS picks the radiation database
  // covering the site (SARAH2 in Europe/Africa, NSRDB in the Americas).
  const url =
    `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}` +
    `&peakpower=1&loss=0&angle=${tilt}&aspect=${aspect}&outputformat=json`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = `PVGIS ${res.status}`;
    try {
      const j = JSON.parse(body) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* keep status-only message */
    }
    throw new Error(msg);
  }
  const json = (await res.json()) as {
    outputs?: { monthly?: { fixed?: Array<{ month: number; "H(i)_m": number }> } };
  };
  const rows = json.outputs?.monthly?.fixed ?? [];
  if (rows.length < 12) throw new Error("PVGIS returned no monthly series");
  const out = new Array<number>(12).fill(0);
  for (const r of rows) {
    const i = r.month - 1;
    if (i >= 0 && i <= 11 && Number.isFinite(r["H(i)_m"])) out[i] = r["H(i)_m"];
  }
  return out;
}



function summarize(bearing: number, aspect: number, monthly: number[]): FacadeSolar {
  const month = new Date().getUTCMonth();
  const daysInMonth = new Date(Date.UTC(2001, month + 1, 0)).getUTCDate();
  const kwhTotal = monthly[month] ?? 0;
  const todayKWhM2 = kwhTotal / daysInMonth;
  // Sinusoidal day profile over an effective solar window → peak ≈ π/2 × mean.
  const daylightHours = 8;
  const peakWM2 = (todayKWhM2 * 1000 * Math.PI) / (2 * daylightHours);
  return {
    bearingDeg: bearing,
    aspectDeg: aspect,
    monthlyKWhM2: monthly,
    todayKWhM2,
    peakWM2,
  };
}

/** Per-facade PVGIS irradiation, cached per property + bearing in the database. */
export const getFacadeSolar = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      lat: number;
      lng: number;
      bearings: number[];
      tilt?: number;
      propertySlug?: string;
    }) => d,
  )
  .handler(async ({ data }): Promise<SolarExposure> => {
    const tilt = data.tilt ?? 90;
    const supabase = serverClient();

    let propertyId: string | null = null;
    if (data.propertySlug) {
      const { data: prop } = await supabase
        .from("properties")
        .select("id")
        .eq("slug", data.propertySlug)
        .maybeSingle();
      propertyId = prop?.id ?? null;
    }

    const bearings = Array.from(new Set(data.bearings.filter((b) => b >= 0)));
    const facades: FacadeSolar[] = [];
    let usedCache = false;
    let usedStale = false;
    let lastError: string | null = null;
    let fetchedAt: string | null = null;

    for (const bearing of bearings) {
      const aspect = compassToAspect(bearing);
      let cached: { hourly_json: unknown; fetched_at: string } | null = null;

      if (propertyId) {
        const { data: row } = await supabase
          .from("solar_cache")
          .select("hourly_json, fetched_at")
          .eq("property_id", propertyId)
          .eq("facade_bearing_deg", bearing)
          .eq("tilt_deg", tilt)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        cached = row ?? null;
        if (row && Date.now() - new Date(row.fetched_at).getTime() < SOLAR_TTL_MS) {
          usedCache = true;
          fetchedAt = fetchedAt ?? row.fetched_at;
          facades.push(
            summarize(bearing, aspect, row.hourly_json as unknown as number[]),
          );
          continue;
        }
      }

      try {
        const monthly = await fetchPvgisMonthly(data.lat, data.lng, aspect, tilt);
        const now = new Date().toISOString();
        fetchedAt = now;
        if (propertyId) {
          await supabase.from("solar_cache").insert({
            property_id: propertyId,
            facade_bearing_deg: bearing,
            tilt_deg: tilt,
            fetched_at: now,
            hourly_json: monthly as unknown as never,
          });
        }
        facades.push(summarize(bearing, aspect, monthly));
      } catch (err) {
        lastError = err instanceof Error ? err.message : "unknown error";
        if (cached) {
          usedStale = true;
          fetchedAt = fetchedAt ?? cached.fetched_at;
          facades.push(
            summarize(bearing, aspect, cached.hourly_json as unknown as number[]),
          );
        }
      }
    }

    if (facades.length === 0) {
      return {
        tier: 3,
        source: "unavailable",
        fetchedAt: null,
        facades: [],
        shadingModelled: false,
        ...(lastError ? { error: lastError } : {}),
      };
    }

    const tier: 1 | 2 | 3 = usedStale ? 2 : 1;
    const source = usedStale ? "stale-cache" : usedCache ? "cache" : "live";
    return {
      tier,
      source,
      fetchedAt,
      facades,
      shadingModelled: false,
      ...(lastError ? { error: lastError } : {}),
    };
  });
