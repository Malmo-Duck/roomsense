import { useMemo, useState } from "react";
import type { RoomPlan } from "@/lib/floorplan";
import { facadeExposure, sunPosition, sunTrack } from "@/lib/solar";
import { cn } from "@/lib/utils";

interface Props {
  plan: RoomPlan;
  lat: number;
  long: number;
  className?: string;
}

const W = 380;
const H = 340;
const PAD = 54;

function localOffsetHours(long: number) {
  return Math.round(long / 15);
}

function fmtHour(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function FloorPlan2D({ plan, lat, long, className }: Props) {
  const valid = Number.isFinite(lat) && Number.isFinite(long);
  const offset = valid ? localOffsetHours(long) : 0;

  const nowLocalHour = useMemo(() => {
    const d = new Date();
    return (d.getUTCHours() + d.getUTCMinutes() / 60 + offset + 24) % 24;
  }, [offset]);

  const [hour, setHour] = useState(nowLocalHour);

  const date = useMemo(() => {
    const d = new Date();
    const utc = hour - offset;
    return new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        0,
        Math.round(utc * 60),
      ),
    );
  }, [hour, offset]);

  const sun = useMemo(
    () => (valid ? sunPosition(date, lat, long) : null),
    [date, lat, long, valid],
  );
  const track = useMemo(
    () => (valid ? sunTrack(date, lat, long, 15) : []),
    [date, lat, long, valid],
  );
  const daylight = track.length
    ? {
        rise: (track[0]!.minutes / 60 + offset + 24) % 24,
        set: (track[track.length - 1]!.minutes / 60 + offset + 24) % 24,
      }
    : null;

  // Fit the plan into the viewport (y flipped: north is up on screen).
  const pts = plan.outline.length >= 3 ? plan.outline : plan.walls.map((w) => w.start);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.5);
  const spanY = Math.max(maxY - minY, 0.5);
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const tx = (p: { x: number; y: number }) => ({
    x: W / 2 + (p.x - cx) * scale,
    y: H / 2 - (p.y - cy) * scale,
  });

  const lit = plan.walls.map((w) =>
    sun ? facadeExposure(w.bearing, sun.azimuth, sun.altitude) : 0,
  );
  const maxExposure = Math.max(0, ...lit);

  // Sun ray: comes from the sun's azimuth toward the room centre.
  const rayLen = Math.min(W, H) / 2 - 8;
  const rayAngle = sun ? sun.azimuth * (Math.PI / 180) : 0;
  const sunPt = {
    x: W / 2 + rayLen * Math.sin(rayAngle),
    y: H / 2 - rayLen * Math.cos(rayAngle),
  };
  const above = !!sun && sun.altitude > 0;

  return (
    <div className={cn("space-y-5", className)}>
      <div className="grid gap-6 lg:grid-cols-[auto_1fr] items-start">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Room floor plan with sun orientation"
          className="mx-auto"
        >
          <defs>
            <radialGradient id="sunglow" cx="50%" cy="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* daylight arc */}
          {track.length > 1 && (
            <polyline
              points={track
                .map((p) => {
                  const a = p.azimuth * (Math.PI / 180);
                  const r = rayLen;
                  return `${W / 2 + r * Math.sin(a)},${H / 2 - r * Math.cos(a)}`;
                })
                .join(" ")}
              fill="none"
              stroke="currentColor"
              className="text-accent-warn/30"
              strokeDasharray="3 5"
              strokeWidth={1.2}
            />
          )}

          {/* sun ray into the plan */}
          {above && (
            <g className="text-accent-warn">
              <line
                x1={sunPt.x}
                y1={sunPt.y}
                x2={W / 2}
                y2={H / 2}
                stroke="currentColor"
                strokeWidth={1}
                opacity={0.35}
              />
              <circle cx={sunPt.x} cy={sunPt.y} r={26} fill="url(#sunglow)" />
              <circle cx={sunPt.x} cy={sunPt.y} r={6} className="fill-accent-warn" />
            </g>
          )}

          {/* footprint */}
          <polygon
            points={pts
              .map((p) => {
                const q = tx(p);
                return `${q.x},${q.y}`;
              })
              .join(" ")}
            className="fill-bg-deep/80 stroke-border-subtle"
            strokeWidth={1}
          />

          {/* walls + windows */}
          {plan.walls.map((w, i) => {
            const a = tx(w.start);
            const b = tx(w.end);
            const exposure = lit[i] ?? 0;
            const strokeClass = !w.external
              ? "text-data-label/40"
              : exposure > 0.03
                ? "text-accent-warn"
                : "text-foreground/70";
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const nx = Math.sin((w.bearing * Math.PI) / 180);
            const ny = -Math.cos((w.bearing * Math.PI) / 180);
            const label = { x: mid.x + nx * 20, y: mid.y + ny * 20 };
            return (
              <g key={w.id + i}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="currentColor"
                  strokeWidth={w.external ? 5 : 3}
                  strokeLinecap="square"
                  className={strokeClass}
                  opacity={exposure > 0.03 ? 0.45 + exposure * 0.55 : 0.85}
                />
                {w.windows.map((win, k) => {
                  const p0 = {
                    x: a.x + (b.x - a.x) * win.t0,
                    y: a.y + (b.y - a.y) * win.t0,
                  };
                  const p1 = {
                    x: a.x + (b.x - a.x) * win.t1,
                    y: a.y + (b.y - a.y) * win.t1,
                  };
                  return (
                    <line
                      key={k}
                      x1={p0.x}
                      y1={p0.y}
                      x2={p1.x}
                      y2={p1.y}
                      stroke="currentColor"
                      strokeWidth={w.external ? 5 : 3}
                      strokeLinecap="butt"
                      className={
                        exposure > 0.03 ? "text-accent-warn" : "text-accent-primary"
                      }
                    />
                  );
                })}
                {w.external && (
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-current text-data-label text-[8px] font-mono"
                  >
                    {w.orientation} {w.lengthM.toFixed(1)}m
                  </text>
                )}
              </g>
            );
          })}

          {/* north arrow */}
          <g transform={`translate(${W - 26}, 26)`}>
            <line
              x1={0}
              y1={16}
              x2={0}
              y2={-8}
              stroke="currentColor"
              className="text-accent-primary/60"
            />
            <polygon points="0,-14 -4,-4 4,-4" className="fill-accent-primary" />
            <text
              y={28}
              textAnchor="middle"
              className="fill-accent-primary text-[8px] font-mono"
            >
              N
            </text>
          </g>
        </svg>

        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Local Time" value={fmtHour(hour)} />
            <Stat label="Altitude" value={sun ? `${sun.altitude.toFixed(0)}°` : "-"} />
            <Stat label="Azimuth" value={sun ? `${sun.azimuth.toFixed(0)}°` : "-"} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-mono text-data-label uppercase">
              <span>
                {daylight
                  ? `Daylight ${fmtHour(daylight.rise)} to ${fmtHour(daylight.set)}`
                  : "Polar day/night"}
              </span>
              <button
                onClick={() => setHour(nowLocalHour)}
                className="hover:text-foreground transition-colors"
              >
                reset to now
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={24}
              step={0.25}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="w-full accent-[var(--accent-warn,#f59e0b)]"
              aria-label="Time of day"
            />
          </div>

          <p className="text-[10px] font-mono text-data-label leading-relaxed">
            {above
              ? "Amber façades are sun-struck at this hour."
              : "Sun below horizon, no solar gain at this hour."}
          </p>
        </div>
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
