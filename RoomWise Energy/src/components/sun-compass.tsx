import { useEffect, useMemo, useState } from "react";
import type { Facade } from "@/lib/types";
import {
  ORIENTATION_BEARING,
  facadeExposure,
  sunPosition,
  sunTrack,
} from "@/lib/solar";
import { cn } from "@/lib/utils";

interface Props {
  facades: Facade[];
  lat: number;
  long: number;
  className?: string;
}

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_RING = 132;

function polar(bearing: number, radius: number) {
  const a = (bearing - 90) * (Math.PI / 180);
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

export function SunCompass({ facades, lat, long, className }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const valid = Number.isFinite(lat) && Number.isFinite(long);
  const sun = useMemo(
    () => (valid ? sunPosition(now, lat, long) : null),
    [now, lat, long, valid],
  );
  const track = useMemo(
    () => (valid ? sunTrack(now, lat, long) : []),
    [now, lat, long, valid],
  );

  const external = facades.filter((f) => f.orientation !== "internal");
  const maxArea = Math.max(1, ...external.map((f) => f.area));

  const sunPt = sun && sun.altitude > 0 ? polar(sun.azimuth, R_RING) : null;

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[auto_1fr] items-center", className)}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto"
        role="img"
        aria-label="Room orientation and sun-path compass"
      >
        {/* sun path arc for today */}
        {track.length > 1 && (
          <polyline
            points={track
              .map((p) => {
                const pt = polar(p.azimuth, R_RING);
                return `${pt.x},${pt.y}`;
              })
              .join(" ")}
            fill="none"
            stroke="currentColor"
            className="text-accent-warn/40"
            strokeWidth={1.5}
            strokeDasharray="3 4"
          />
        )}

        {/* compass ring */}
        <circle
          cx={CX}
          cy={CY}
          r={R_RING}
          fill="none"
          stroke="currentColor"
          className="text-border-subtle"
          strokeWidth={1}
        />

        {/* cardinal ticks */}
        {Object.entries(ORIENTATION_BEARING).map(([label, bearing]) => {
          const outer = polar(bearing, R_RING);
          const inner = polar(bearing, R_RING - (bearing % 90 === 0 ? 12 : 6));
          const text = polar(bearing, R_RING + 14);
          return (
            <g key={label}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="currentColor"
                className="text-border-subtle"
              />
              {bearing % 90 === 0 && (
                <text
                  x={text.x}
                  y={text.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={cn(
                    "text-[9px] font-mono",
                    label === "N" ? "fill-accent-primary" : "fill-current text-data-label",
                  )}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* north arrow */}
        <line
          x1={CX}
          y1={CY}
          x2={CX}
          y2={CY - R_RING + 18}
          stroke="currentColor"
          className="text-accent-primary/60"
          strokeWidth={1.5}
        />
        <polygon
          points={`${CX},${CY - R_RING + 8} ${CX - 5},${CY - R_RING + 20} ${CX + 5},${CY - R_RING + 20}`}
          className="fill-accent-primary"
        />

        {/* room footprint */}
        <rect
          x={CX - 46}
          y={CY - 34}
          width={92}
          height={68}
          rx={4}
          className="fill-bg-deep stroke-border-subtle"
          strokeWidth={1}
        />
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-current text-data-label text-[8px] font-mono"
        >
          ROOM
        </text>

        {/* facades as bars pointing outward along their bearing */}
        {external.map((f) => {
          const bearing = ORIENTATION_BEARING[f.orientation] ?? 0;
          const inner = polar(bearing, 56);
          const len = 20 + (f.area / maxArea) * 40;
          const outer = polar(bearing, 56 + len);
          const exposure = sun
            ? facadeExposure(bearing, sun.azimuth, sun.altitude)
            : 0;
          const glazed = f.glazingArea > 0;
          return (
            <g key={f.id}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth={glazed ? 7 : 4}
                className={
                  exposure > 0.05
                    ? "text-accent-warn"
                    : glazed
                      ? "text-accent-primary"
                      : "text-data-label/50"
                }
                opacity={exposure > 0.05 ? 0.4 + exposure * 0.6 : 0.7}
              />
              <text
                x={polar(bearing, 56 + len + 12).x}
                y={polar(bearing, 56 + len + 12).y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-current text-data-label text-[8px] font-mono"
              >
                {f.orientation}
              </text>
            </g>
          );
        })}

        {/* sun marker */}
        {sunPt && (
          <g>
            <line
              x1={CX}
              y1={CY}
              x2={sunPt.x}
              y2={sunPt.y}
              stroke="currentColor"
              className="text-accent-warn/50"
              strokeWidth={1}
            />
            <circle cx={sunPt.x} cy={sunPt.y} r={9} className="fill-accent-warn/25" />
            <circle cx={sunPt.x} cy={sunPt.y} r={5} className="fill-accent-warn" />
          </g>
        )}
      </svg>

      <div className="space-y-3">
        {!valid ? (
          <p className="text-[11px] font-mono text-data-label">
            No coordinates yet. Enter latitude/longitude to resolve sun geometry.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Sun Azimuth"
                value={sun ? `${sun.azimuth.toFixed(0)}°` : "-"}
              />
              <Stat
                label="Sun Altitude"
                value={sun ? `${sun.altitude.toFixed(1)}°` : "-"}
              />
              <Stat label="Latitude" value={`${lat.toFixed(4)}°`} />
              <Stat label="Longitude" value={`${long.toFixed(4)}°`} />
            </div>
            <p className="text-[10px] font-mono text-data-label leading-relaxed">
              {sun && sun.altitude > 0
                ? "Sun above horizon: lit façades highlighted amber, intensity scaled by angle of incidence."
                : "Sun below horizon: dashed arc shows today's daylight track. No solar gain right now."}
            </p>
            <div className="flex flex-wrap gap-3 text-[9px] font-mono text-data-label uppercase">
              <Legend className="bg-accent-primary" label="North / glazed" />
              <Legend className="bg-accent-warn" label="Sunlit façade" />
              <Legend className="bg-data-label/50" label="Shaded façade" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-bg-deep/50 rounded border border-border-subtle">
      <div className="text-[9px] font-mono text-data-label uppercase">{label}</div>
      <div className="text-sm font-mono text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}
