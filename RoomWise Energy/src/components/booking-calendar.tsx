import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Plus, Trash2, Check, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface BookingRow {
  id: string;
  check_in_at: string | null;
  check_out_at: string | null;
}

interface Props {
  roomId: string;
}

/** ISO string → value for <input type="datetime-local"> (local wall clock). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Synthetic starter calendar — clearly labelled demo data, editable below. */
function dummyBookings(): Array<{ check_in_at: string; check_out_at: string }> {
  const now = Date.now();
  const h = 3600_000;
  return [
    { check_in_at: new Date(now + 9 * h), check_out_at: new Date(now + 33 * h) },
    { check_in_at: new Date(now + 56 * h), check_out_at: new Date(now + 104 * h) },
    { check_in_at: new Date(now + 128 * h), check_out_at: new Date(now + 152 * h) },
  ].map((b) => ({
    check_in_at: b.check_in_at.toISOString(),
    check_out_at: b.check_out_at.toISOString(),
  }));
}

const inputCls =
  "w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:border-accent-primary outline-none transition-colors";

export function BookingCalendar({ roomId }: Props) {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftIn, setDraftIn] = useState("");
  const [draftOut, setDraftOut] = useState("");
  // StrictMode runs effects twice; without this the demo seed inserts twice.
  const seededFor = useRef<string | null>(null);

  const load = useCallback(
    async (seedIfEmpty: boolean) => {
      const { data } = await supabase
        .from("bookings")
        .select("id, check_in_at, check_out_at")
        .eq("room_id", roomId)
        .order("check_in_at", { ascending: true });

      if (seedIfEmpty && (!data || data.length === 0) && seededFor.current !== roomId) {
        seededFor.current = roomId;
        await supabase
          .from("bookings")
          .insert(dummyBookings().map((b) => ({ ...b, room_id: roomId })));
        const { data: seeded } = await supabase
          .from("bookings")
          .select("id, check_in_at, check_out_at")
          .eq("room_id", roomId)
          .order("check_in_at", { ascending: true });
        setRows(seeded ?? []);
      } else {
        setRows(data ?? []);
      }
      setLoading(false);
    },
    [roomId],
  );

  useEffect(() => {
    setLoading(true);
    void load(true);
  }, [load]);

  async function addBooking() {
    const start = new Date(Date.now() + 24 * 3600_000);
    const end = new Date(start.getTime() + 24 * 3600_000);
    const { data } = await supabase
      .from("bookings")
      .insert({
        room_id: roomId,
        check_in_at: start.toISOString(),
        check_out_at: end.toISOString(),
      })
      .select("id, check_in_at, check_out_at")
      .single();
    if (data) {
      setRows((r) => [...r, data]);
      startEdit(data);
    }
  }

  function startEdit(b: BookingRow) {
    setEditingId(b.id);
    setDraftIn(toLocalInput(b.check_in_at));
    setDraftOut(toLocalInput(b.check_out_at));
  }

  async function saveEdit(id: string) {
    const patch = {
      check_in_at: fromLocalInput(draftIn),
      check_out_at: fromLocalInput(draftOut),
    };
    await supabase.from("bookings").update(patch).eq("id", id);
    setRows((r) => r.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setEditingId(null);
  }

  async function remove(id: string) {
    await supabase.from("bookings").delete().eq("id", id);
    setRows((r) => r.filter((b) => b.id !== id));
  }

  const now = Date.now();
  const upcoming = rows
    .filter((b) => b.check_in_at && new Date(b.check_in_at).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.check_in_at!).getTime() - new Date(b.check_in_at!).getTime(),
    );
  const next = upcoming[0];
  const hoursToCheckIn = next
    ? (new Date(next.check_in_at!).getTime() - now) / 3600_000
    : null;
  const occupiedNow = rows.some(
    (b) =>
      b.check_in_at &&
      b.check_out_at &&
      new Date(b.check_in_at).getTime() <= now &&
      new Date(b.check_out_at).getTime() > now,
  );

  return (
    <section className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-accent-primary" />
          <h2 className="text-sm font-semibold">Booking Calendar</h2>
          <span className="text-[9px] font-mono uppercase tracking-widest text-data-label border border-border-subtle rounded px-1.5 py-0.5">
            Synthetic
          </span>
        </div>
        <button
          onClick={() => void addBooking()}
          className="text-[10px] font-mono px-3 py-1.5 bg-accent-primary text-white rounded hover:bg-blue-500 transition-colors flex items-center gap-1.5"
        >
          <Plus className="size-3" />
          ADD
        </button>
      </div>

      <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-border-subtle">
        <div className="p-3 bg-bg-deep/50 rounded border border-border-subtle">
          <div className="text-[9px] font-mono uppercase text-data-label">
            Status now
          </div>
          <div
            className={cn(
              "text-sm font-mono mt-0.5",
              occupiedNow ? "text-accent-warn" : "text-accent-success",
            )}
          >
            {occupiedNow ? "OCCUPIED" : "UNOCCUPIED · setback active"}
          </div>
        </div>
        <div className="p-3 bg-bg-deep/50 rounded border border-border-subtle">
          <div className="text-[9px] font-mono uppercase text-data-label">
            Hours to next check-in
          </div>
          <div className="text-sm font-mono text-foreground mt-0.5">
            {hoursToCheckIn === null ? "-" : `${hoursToCheckIn.toFixed(1)} h`}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border-subtle/60">
        {loading && (
          <div className="px-6 py-4 text-xs text-data-label">Loading calendar…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="px-6 py-4 text-xs text-data-label">
            No bookings yet. Add one to drive the recovery estimate.
          </div>
        )}
        {rows.map((b) => {
          const editing = editingId === b.id;
          return (
            <div key={b.id} className="px-6 py-3">
              {editing ? (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex-1 min-w-[150px] space-y-1">
                    <span className="text-[9px] font-mono uppercase text-data-label">
                      Check-in
                    </span>
                    <input
                      type="datetime-local"
                      value={draftIn}
                      onChange={(e) => setDraftIn(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex-1 min-w-[150px] space-y-1">
                    <span className="text-[9px] font-mono uppercase text-data-label">
                      Check-out
                    </span>
                    <input
                      type="datetime-local"
                      value={draftOut}
                      onChange={(e) => setDraftOut(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => void saveEdit(b.id)}
                      className="p-2 rounded bg-accent-primary text-white hover:bg-blue-500 transition-colors"
                      title="Save"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 rounded border border-border-subtle text-data-label hover:text-foreground transition-colors"
                      title="Cancel"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 group">
                  <div className="text-[11px] font-mono text-foreground">
                    {fmt(b.check_in_at)}
                    <span className="text-data-label"> → </span>
                    {fmt(b.check_out_at)}
                    {next?.id === b.id && (
                      <span className="ml-2 text-[9px] uppercase text-accent-primary">
                        next
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(b)}
                      className="p-1.5 text-data-label hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => void remove(b.id)}
                      className="p-1.5 text-data-label hover:text-accent-warn transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
