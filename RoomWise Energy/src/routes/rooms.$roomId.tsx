import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trash2, Save, Radar, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/app-shell";

import { FloorPlan2D } from "@/components/floor-plan-2d";
import { BookingCalendar } from "@/components/booking-calendar";
import { AiSettingsPanel } from "@/components/ai-settings-panel";
import { SolarExposurePanel } from "@/components/solar-exposure";
import { getBuildingLevels } from "@/lib/live-data.functions";
import { planFromFacades } from "@/lib/floorplan";
import { useStore, updateRoom, deleteRoom } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rooms/$roomId")({
  head: () => ({
    meta: [
      { title: "Room Detail | RoomSense" },
      {
        name: "description",
        content:
          "Per-room thermal breakdown, UA, solar gain, and confidence-scored setback recommendation.",
      },
    ],
  }),
  component: RoomDetailPage,
});

const inputCls =
  "w-full bg-bg-deep border border-border-subtle rounded px-3 py-2 text-sm font-mono text-foreground focus:border-accent-primary outline-none transition-colors";

function RoomDetailPage() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const { rooms } = useStore();
  const room = rooms.find((r) => r.id === roomId);

  const [floor, setFloor] = useState(room?.floorNumber ?? 1);
  const [levels, setLevels] = useState(room?.totalLevels ?? 1);
  const [lat, setLat] = useState(room?.lat ?? 0);
  const [lng, setLng] = useState(room?.long ?? 0);
  const [dirty, setDirty] = useState(false);
  const [detectingLevels, setDetectingLevels] = useState(false);
  const [derivationOpen, setDerivationOpen] = useState(false);
  const fetchLevels = useServerFn(getBuildingLevels);

  // Room data arrives asynchronously; adopt its values until the user edits.
  useEffect(() => {
    if (!room || dirty) return;
    setFloor(room.floorNumber);
    setLevels(room.totalLevels);
    setLat(room.lat);
    setLng(room.long);
  }, [room, dirty]);

  if (!room) {
    return (
      <AppShell>
        <div className="p-4 sm:p-8 max-w-5xl mx-auto">
          <p className="text-data-label">Room not found.</p>
          <Link to="/portfolio" className="text-accent-primary text-sm hover:underline">
            ← Back to portfolio
          </Link>
        </div>
      </AppShell>
    );
  }

  const r = room.result;
  const plan = room.plan ?? planFromFacades(room.facades, room.ceilingHeight);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  async function detectLevels() {
    setDetectingLevels(true);
    try {
      const res = await fetchLevels({ data: { lat, lng } });
      if (res.levels) markDirty(setLevels)(res.levels);
    } finally {
      setDetectingLevels(false);
    }
  }

  function save() {
    updateRoom(room!.id, {
      floorNumber: floor,
      totalLevels: levels,
      lat,
      long: lng,
    });
    setDirty(false);
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/portfolio"
              className="text-data-label hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {room.label}
              </h1>
              <p className="text-[10px] font-mono text-data-label uppercase">
                {room.propertyName} · SOURCE: {room.sourceFile ?? "manual"}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              deleteRoom(room.id);
              navigate({ to: "/portfolio" });
            }}
            className="text-[10px] font-mono px-3 py-2 text-data-label border border-border-subtle rounded hover:text-accent-warn transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="size-3.5" />
            REMOVE
          </button>
        </div>

        {/* AI recommendation — the first thing on the page, reasoning expanded
            by default so the "why" is visible without an extra click. Mock
            signal values live inside it too, collapsed until asked for, so
            changing one and seeing the recommendation react happens in the
            same view. */}
        <AiSettingsPanel room={room} defaultReasoningOpen />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center">
                <h2 className="text-sm font-semibold">Floor Plan &amp; Sun Path</h2>
                <span className="text-[10px] font-mono text-data-label">
                  {plan.source === "scan" ? "LIDAR OUTLINE" : "DERIVED OUTLINE"} ·{" "}
                  {plan.footprintM2.toFixed(1)} m²
                </span>
              </div>
              <div className="p-6">
                <FloorPlan2D plan={plan} lat={lat} long={lng} />
              </div>
            </section>

            <BookingCalendar roomId={room.id} />

            <section className="bg-surface border border-border-subtle rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-semibold">Environmental Parameters</h2>
                {dirty && (
                  <button
                    onClick={save}
                    className="text-[10px] font-mono px-3 py-2 bg-accent-primary text-white rounded hover:bg-blue-500 transition-colors flex items-center gap-1.5"
                  >
                    <Save className="size-3.5" />
                    RECOMPUTE
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Field label="Floor Number">
                  <input
                    type="number"
                    value={floor}
                    onChange={(e) => markDirty(setFloor)(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Total Levels">
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={levels}
                      onChange={(e) => markDirty(setLevels)(Number(e.target.value))}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => void detectLevels()}
                      title="Detect from OSM"
                      className="shrink-0 px-2.5 rounded border border-border-subtle text-data-label hover:text-foreground hover:border-accent-primary transition-colors"
                    >
                      <Radar className={cn("size-4", detectingLevels && "animate-pulse")} />
                    </button>
                  </div>
                </Field>
                <Field label="Latitude">
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => markDirty(setLat)(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => markDirty(setLng)(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
              </div>
              <p className="text-[10px] font-mono text-data-label mt-4">
                Ceiling height {room.ceilingHeight.toFixed(2)} m · editing floor/levels/geo
                recomputes UA, solar gain, and confidence on save.
              </p>
            </section>
          </div>

          {/* Right: supporting live data */}
          <div className="space-y-6">
            <SolarExposurePanel
              lat={lat}
              long={lng}
              orientations={room.facades.map((f) => f.orientation)}
              propertySlug={room.propertyId}
            />

            <section className="bg-surface border border-border-subtle rounded-xl p-6">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-data-label mb-4">
                Thermal History
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                  <span className="text-[11px] font-mono text-data-label">
                    {new Date(room.createdAt).toISOString().slice(0, 10)}
                  </span>
                  <span className="text-[11px] text-foreground">{r.setbackC}°C rec.</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[11px] font-mono text-data-label">Initial Parse</span>
                  <span className="text-[11px] text-accent-success">SUCCESS</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Spatial Derivation — reference detail, collapsed at the bottom so
            it doesn't compete with the recommendation for attention. */}
        <section className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          <button
            onClick={() => setDerivationOpen((v) => !v)}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-foreground/[0.02] transition-colors"
          >
            <span className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Spatial Derivation</h2>
              <ChevronDown
                className={cn(
                  "size-4 text-data-label transition-transform",
                  derivationOpen && "rotate-180",
                )}
              />
            </span>
            <span className="text-[10px] font-mono text-data-label">
              UA {r.uaTotal.toFixed(1)} W/K · {r.footprint.toFixed(1)} m² footprint
            </span>
          </button>
          {derivationOpen && (
            <div className="p-6 border-t border-border-subtle">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {room.facades.map((f, i) => {
                  const row = r.facades[i];
                  return (
                    <div key={f.id} className="p-3 bg-bg-deep rounded border border-border-subtle">
                      <div className="text-[10px] font-mono text-data-label uppercase">
                        {f.orientation} Façade
                      </div>
                      <div className="text-xl font-mono mt-1 text-foreground">
                        {f.area.toFixed(1)}
                        <span className="text-xs text-data-label">m²</span>
                      </div>
                      <div
                        className={cn(
                          "text-[9px] mt-1",
                          f.glazingArea > 0 ? "text-accent-success" : "text-data-label",
                        )}
                      >
                        {f.glazingArea > 0
                          ? `Glazing: ${Math.round(row?.glazingPct ? row.glazingPct * 100 : 0)}%`
                          : "Internal wall"}
                      </div>
                      {row && (
                        <div className="text-[9px] font-mono text-data-label mt-1">
                          {row.totalUa.toFixed(1)} W/K
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-mono">
                <Breakdown label="Wall UA" value={r.wallUa} />
                <Breakdown label="Glazing UA" value={r.glazingUa} />
                <Breakdown label="Roof UA" value={r.roofUa} />
                <Breakdown label="Slab UA" value={r.floorUa} />
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2 bg-bg-deep/50 rounded border border-border-subtle">
      <div className="text-data-label uppercase">{label}</div>
      <div className="text-foreground mt-0.5">{value.toFixed(1)} W/K</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono text-data-label uppercase">{label}</label>
      {children}
    </div>
  );
}
