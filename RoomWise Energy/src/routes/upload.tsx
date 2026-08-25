import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { FileJson, Sparkles, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { addRoom } from "@/lib/store";
import { SAMPLE_SCAN_JSON, SAMPLE_SCAN_RECORD } from "@/lib/sample-data";
import type { RoomScanRecord } from "@/lib/types";
import { parseRecord } from "@/lib/scan-parse";
import { SkanzaLink } from "@/components/skanza-steps";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Add a Room Scan | RoomSense" },
      {
        name: "description",
        content:
          "Drop a Skanza LiDAR Record JSON to derive facades and compute an optimal setback temperature.",
      },
    ],
  }),
  component: UploadPage,
});

type Stage = "drop" | "parsed";

function UploadPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("drop");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<RoomScanRecord | null>(null);
  const [sourceFile, setSourceFile] = useState<string | undefined>();

  // Editable inputs
  const [propertyName, setPropertyName] = useState("Grand Plaza Resort");
  const [label, setLabel] = useState("Room 410");
  const [floorNumber, setFloorNumber] = useState(4);
  const [totalLevels, setTotalLevels] = useState(12);
  const [lat, setLat] = useState(40.7128);
  const [long, setLong] = useState(-74.006);

  function handleParse(raw: string, file?: string) {
    setError(null);
    try {
      const rec = parseRecord(raw);
      setScan(rec);
      setSourceFile(file);
      if (rec.gps) {
        setLat(rec.gps.lat);
        setLong(rec.gps.long);
      }
      if (typeof rec.floorNumber === "number") setFloorNumber(rec.floorNumber);
      if (rec.recordId) setLabel(`Room ${rec.recordId.replace(/[^0-9]/g, "") || "scan"}`);
      setStage("parsed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse record.");
      setStage("drop");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      setText(raw);
      handleParse(raw, file.name);
    };
    reader.readAsText(file);
  }

  function loadSample() {
    setText(SAMPLE_SCAN_JSON);
    setPropertyName("Grand Plaza Resort");
    setLabel("Room 410");
    handleParse(SAMPLE_SCAN_JSON, "sample_record.json");
  }

  async function compute() {
    if (!scan) return;
    const room = await addRoom({
      scan,
      propertyName,
      label,
      floorNumber,
      totalLevels,
      lat,
      long,
      ...(sourceFile ? { sourceFile } : {}),
    });
    if (!room) return;
    navigate({ to: "/rooms/$roomId", params: { roomId: room.id } });
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Link to="/portfolio" className="text-data-label hover:text-foreground transition-colors">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Add a Room Scan
            </h1>
            <p className="text-sm text-data-label mt-1">
              Drop the scan file from your phone. We read the walls and windows, then ask for the
              floor and property before calculating.
            </p>
            <a
              href="https://skanza.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[10px] font-mono uppercase tracking-widest text-data-label mt-2 hover:text-foreground transition-colors"
            >
              Powered by Skanza scans
            </a>
          </div>
        </div>

        {stage === "drop" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="aspect-square border border-dashed border-border-subtle rounded-xl flex flex-col items-center justify-center p-8 bg-surface/30 hover:border-accent-primary/50 transition-colors"
              >
                <FileJson className="size-8 text-data-label mb-4" />
                <p className="text-sm font-medium text-foreground text-center mb-1">
                  Drop your scan file here
                </p>
                <p className="text-[10px] font-mono text-data-label uppercase">
                  .json · <SkanzaLink /> scan parser v2.4
                </p>
                <label className="mt-6 text-[10px] font-mono px-3 py-2 bg-surface text-foreground border border-border-subtle rounded hover:bg-foreground/5 transition-colors cursor-pointer">
                  SELECT_FILE
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const raw = String(reader.result);
                        setText(raw);
                        handleParse(raw, file.name);
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>
              <button
                onClick={loadSample}
                className="mt-4 w-full text-[10px] font-mono px-3 py-2 bg-accent-primary/10 text-accent-primary border border-accent-primary/20 rounded hover:bg-accent-primary/20 transition-colors"
              >
                LOAD_SAMPLE_RECORD
              </button>
            </div>

            <div className="lg:col-span-7">
              <label className="text-[10px] font-mono text-data-label uppercase tracking-wider">
                Or paste Record JSON
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='{ "recordId": "RM_410_SCAN", "ceilingHeight": 2.75, "facades": [...] }'
                className="w-full h-64 mt-2 bg-bg-deep border border-border-subtle rounded px-3 py-2 text-xs font-mono text-foreground focus:border-accent-primary outline-none transition-colors resize-none"
              />
              {error && <p className="text-[11px] font-mono text-accent-warn mt-2">{error}</p>}
              <button
                onClick={() => handleParse(text || SAMPLE_SCAN_JSON)}
                className="mt-3 text-[10px] font-mono px-4 py-2 bg-accent-primary text-white rounded hover:bg-blue-500 transition-colors"
              >
                PARSE_RECORD
              </button>
            </div>
          </div>
        )}

        {stage === "parsed" && scan && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <section className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center">
                  <h2 className="text-sm font-semibold">Spatial Derivation</h2>
                  <span className="text-[10px] font-mono text-data-label">
                    {scan.recordId} · VALIDATED
                  </span>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {scan.facades.map((f) => (
                      <div
                        key={f.id}
                        className="p-3 bg-bg-deep rounded border border-border-subtle"
                      >
                        <div className="text-[10px] font-mono text-data-label uppercase">
                          {f.id} · {f.orientation}
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
                            ? `Glazing: ${Math.round((f.glazingArea / f.area) * 100)}%`
                            : "Internal wall"}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-[10px] font-mono text-data-label">
                    Ceiling height: {scan.ceilingHeight.toFixed(2)} m
                    {scan.gps && ` · GPS ${scan.gps.lat.toFixed(4)}, ${scan.gps.long.toFixed(4)}`}
                  </div>
                </div>
              </section>

              <section className="bg-surface border border-border-subtle rounded-xl p-6">
                <h2 className="text-sm font-semibold mb-6">Environmental Parameters</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <Field label="Property Name">
                    <input
                      value={propertyName}
                      onChange={(e) => setPropertyName(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Room Label">
                    <input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Floor Number">
                    <input
                      type="number"
                      value={floorNumber}
                      onChange={(e) => setFloorNumber(Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Total Levels">
                    <input
                      type="number"
                      value={totalLevels}
                      onChange={(e) => setTotalLevels(Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Latitude">
                    <input
                      type="number"
                      step="0.0001"
                      value={lat}
                      onChange={(e) => setLat(Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Longitude">
                    <input
                      type="number"
                      step="0.0001"
                      value={long}
                      onChange={(e) => setLong(Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </section>
            </div>

            <div className="lg:col-span-5">
              <section className="bg-accent-primary/10 border border-accent-primary/20 rounded-xl p-6 sticky top-8">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-accent-primary mb-6">
                  Compute Engine
                </h2>
                <p className="text-sm text-foreground leading-relaxed mb-6">
                  The engine will compute UA, solar gain, and a confidence-scored setback
                  temperature from the derived facades and the parameters above.
                </p>
                <button
                  onClick={compute}
                  className="w-full py-3 bg-accent-primary hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles className="size-4" />
                  COMPUTE_OPTIMIZATION
                </button>
                <button
                  onClick={() => setStage("drop")}
                  className="w-full mt-3 text-[10px] font-mono text-data-label hover:text-foreground transition-colors"
                >
                  ← Back to dropzone
                </button>
              </section>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const inputCls =
  "w-full bg-bg-deep border border-border-subtle rounded px-3 py-2 text-sm font-mono text-foreground focus:border-accent-primary outline-none transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono text-data-label uppercase">{label}</label>
      {children}
    </div>
  );
}
