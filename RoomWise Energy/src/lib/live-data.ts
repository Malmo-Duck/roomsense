// Shared client-safe types + helpers for the live external data feeds.

export interface HourlyWeather {
  timezone: string;
  time: string[];
  temperatureC: number[];
  cloudCoverPct: number[];
}

export interface LiveConditions {
  /** 1 = live/fresh, 2 = stale cache, 3 = unavailable */
  tier: 1 | 2 | 3;
  source: "live" | "cache" | "stale-cache" | "unavailable";
  fetchedAt: string | null;
  weather: HourlyWeather | null;
  error?: string;
}

export interface BuildingLevels {
  tier: 1 | 2 | 3;
  levels: number | null;
  name: string | null;
  error?: string;
}

/** Index of the hourly sample closest to `when` (local ISO strings from Open-Meteo). */
export function nowIndex(weather: HourlyWeather, when = new Date()): number {
  const target = when.getTime();
  let best = 0;
  let bestDiff = Infinity;
  weather.time.forEach((t, i) => {
    const diff = Math.abs(new Date(t + "Z").getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
}
