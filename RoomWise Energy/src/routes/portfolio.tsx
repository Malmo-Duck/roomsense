import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload, Building2, Thermometer, Gauge, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useStore, deleteRoom, resetStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Overview | RoomSense" },
      {
        name: "description",
        content:
          "Turn per-room LiDAR scans into optimal hotel setback temperatures with confidence-scored thermal modeling.",
      },
      { property: "og:title", content: "Portfolio Overview | RoomSense" },
      {
        property: "og:description",
        content:
          "Turn per-room LiDAR scans into optimal hotel setback temperatures with confidence-scored thermal modeling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioPage,
});

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-data-label">
          {label}
        </span>
        <span className="text-data-label">{icon}</span>
      </div>
      <div className="text-2xl font-mono mt-3 text-foreground">{value}</div>
      {hint && <div className="text-[10px] font-mono text-data-label mt-1">{hint}</div>}
    </div>
  );
}

function confidenceTone(c: number) {
  if (c >= 0.8) return "bg-accent-success";
  if (c >= 0.6) return "bg-accent-primary";
  return "bg-accent-warn";
}

function PortfolioPage() {
  const { rooms } = useStore();

  const byProperty = new Map<string, { id: string; name: string; rooms: typeof rooms }>();
  for (const r of rooms) {
    let g = byProperty.get(r.propertyId);
    if (!g) {
      g = { id: r.propertyId, name: r.propertyName, rooms: [] };
      byProperty.set(r.propertyId, g);
    }
    g.rooms.push(r);
  }
  const properties = Array.from(byProperty.values());

  const avgSetback =
    rooms.length > 0
      ? (rooms.reduce((s, r) => s + r.result.setbackC, 0) / rooms.length).toFixed(1)
      : "-";
  const avgConf =
    rooms.length > 0
      ? Math.round((rooms.reduce((s, r) => s + r.result.confidence, 0) / rooms.length) * 100)
      : 0;

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Portfolio Overview
            </h1>
            <p className="text-sm text-data-label mt-1">
              Per-room setback recommendations across your properties.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetStore}
              className="text-[10px] font-mono px-3 py-2 bg-surface text-data-label border border-border-subtle rounded hover:text-foreground transition-colors"
            >
              RESET_SEED
            </button>
            <Link
              to="/upload"
              className="text-[10px] font-mono px-3 py-2 bg-accent-primary text-white rounded hover:bg-blue-500 transition-colors flex items-center gap-1.5"
            >
              <Upload className="size-3.5" />
              UPLOAD_RECORD
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Building2 className="size-3.5" />}
            label="Properties"
            value={String(properties.length)}
          />
          <StatCard
            icon={<Thermometer className="size-3.5" />}
            label="Rooms Optimized"
            value={String(rooms.length)}
          />
          <StatCard
            icon={<Gauge className="size-3.5" />}
            label="Avg Setback"
            value={`${avgSetback}°C`}
            hint="unoccupied target"
          />
          <StatCard
            icon={<Gauge className="size-3.5" />}
            label="Avg Confidence"
            value={`${avgConf}%`}
          />
        </div>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-data-label mb-4">
            Room Inventory
          </h2>
          <div className="bg-surface border border-border-subtle rounded-xl overflow-x-auto">
            <table className="w-full min-w-[760px] text-left border-collapse">
              <thead>
                <tr className="bg-bg-deep/50 border-b border-border-subtle">
                  <th className="px-6 py-3 text-[10px] font-mono text-data-label uppercase tracking-wider">
                    Property / Room
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono text-data-label uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono text-data-label uppercase tracking-wider text-right">
                    UA Loss
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono text-data-label uppercase tracking-wider text-right">
                    Setback
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono text-data-label uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {properties.map((p) => (
                  <PropertyGroup key={p.id} property={p} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function PropertyGroup({
  property,
}: {
  property: { id: string; name: string; rooms: ReturnType<typeof useStore>["rooms"] };
}) {
  return (
    <>
      <tr className="bg-foreground/[0.02]">
        <td colSpan={6} className="px-6 py-2 text-[10px] font-mono text-data-label">
          PROPERTY: {property.name} · {property.rooms.length} rooms
        </td>
      </tr>
      {property.rooms.map((r) => (
        <tr
          key={r.id}
          className="hover:bg-foreground/[0.03] transition-colors cursor-pointer group"
        >
          <td className="px-6 py-3">
            <Link to="/rooms/$roomId" params={{ roomId: r.id }} className="block">
              <div className="text-sm font-medium text-foreground">{r.label}</div>
              <div className="text-[10px] font-mono text-data-label uppercase">
                {r.propertyName}
              </div>
            </Link>
          </td>
          <td className="px-6 py-3 font-mono text-xs text-data-label">
            {r.floorNumber}/{r.totalLevels}
          </td>
          <td className="px-6 py-3 font-mono text-xs text-data-label text-right">
            {r.result.uaTotal.toFixed(1)} W/K
          </td>
          <td className="px-6 py-3 font-mono text-sm text-foreground text-right font-medium">
            {r.result.setbackC}°C
          </td>
          <td className="px-6 py-3">
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                <div
                  className={cn("h-full", confidenceTone(r.result.confidence))}
                  style={{ width: `${Math.round(r.result.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-data-label">
                {Math.round(r.result.confidence * 100)}%
              </span>
            </div>
          </td>
          <td className="px-6 py-3 text-right">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteRoom(r.id);
              }}
              className="text-data-label hover:text-accent-warn transition-colors opacity-0 group-hover:opacity-100"
              title="Remove room"
            >
              <Trash2 className="size-3.5 inline" />
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}
