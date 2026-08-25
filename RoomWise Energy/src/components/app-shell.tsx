import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Upload, Sun, Moon } from "lucide-react";
import { useStore, hydrateStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/wordmark";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";

function ThemeToggle() {
  // Server always renders the dark-theme icon; sync to the real (possibly
  // localStorage-driven) theme once mounted — same pattern as store hydration.
  const [theme, setThemeState] = useState<Theme>("dark");
  useEffect(() => setThemeState(getTheme()), []);

  return (
    <button
      onClick={() => setThemeState(toggleTheme())}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="p-1.5 rounded text-data-label hover:text-foreground hover:bg-foreground/5 transition-colors"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function useGroupedProperties() {
  const { rooms } = useStore();
  const map = new Map<string, { id: string; name: string; rooms: typeof rooms }>();
  for (const r of rooms) {
    let g = map.get(r.propertyId);
    if (!g) {
      g = { id: r.propertyId, name: r.propertyName, rooms: [] };
      map.set(r.propertyId, g);
    }
    g.rooms.push(r);
  }
  return Array.from(map.values());
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // Hydrate from localStorage once, on the client only.
  useEffect(() => {
    hydrateStore();
  }, []);

  const properties = useGroupedProperties();
  const router = useRouterState();
  const path = router.location.pathname;

  // Build a breadcrumb from the current path.
  const crumbs: { label: string; to?: string }[] = [{ label: "Portfolio", to: "/portfolio" }];
  if (path.startsWith("/upload")) {
    crumbs.push({ label: "Upload" });
  } else if (path.startsWith("/rooms/")) {
    crumbs.push({ label: "Room" });
  }

  return (
    <div className="flex min-h-screen bg-bg-deep text-foreground font-sans">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border-subtle flex-col shrink-0">
        <div className="p-6 border-b border-border-subtle">
          <Wordmark size="sm" asLink />
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-data-label mb-3 px-2">
              Portfolio
            </h3>
            <div className="space-y-1">
              {properties.length === 0 && (
                <p className="px-2 text-xs text-data-label">No rooms yet.</p>
              )}
              {properties.map((p) => {
                const active = path.includes(`/rooms/`)
                  ? p.rooms.some((r) => path.endsWith(`/rooms/${r.id}`))
                  : false;
                return (
                  <div key={p.id} className="group">
                    <Link
                      to="/portfolio"
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 text-sm font-medium rounded transition-colors",
                        active
                          ? "text-foreground bg-foreground/5"
                          : "text-data-label hover:bg-foreground/5 hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] bg-border-subtle px-1.5 py-0.5 rounded">
                        {p.rooms.length}
                      </span>
                    </Link>
                    <div className="pl-4 mt-1 space-y-1 border-l border-border-subtle ml-3">
                      {p.rooms.map((r) => {
                        const isActive = path.endsWith(`/rooms/${r.id}`);
                        return (
                          <Link
                            key={r.id}
                            to="/rooms/$roomId"
                            params={{ roomId: r.id }}
                            className={cn(
                              "block px-2 py-1 text-xs rounded transition-colors",
                              isActive
                                ? "text-accent-primary"
                                : "text-data-label hover:text-foreground",
                            )}
                          >
                            {r.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-data-label mb-3 px-2">
              Queue
            </h3>
            <Link
              to="/upload"
              className="block px-2 py-3 bg-foreground/5 rounded-lg border border-dashed border-foreground/10 text-center hover:border-accent-primary/40 transition-colors"
            >
              <Upload className="size-3.5 mx-auto mb-2 text-accent-primary" />
              <p className="text-[10px] text-data-label mb-1">Pending room scans</p>
              <span className="text-[10px] font-semibold text-accent-primary uppercase tracking-tighter">
                Upload JSON
              </span>
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main workspace */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border-subtle flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden shrink-0">
              <Wordmark size="sm" asLink />
            </div>
            <span className="lg:hidden text-border-subtle">/</span>
            <div className="flex items-center gap-2 text-sm min-w-0">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-border-subtle">/</span>}
                  {c.to ? (
                    <Link to={c.to} className="text-data-label hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span
                      className={
                        i === crumbs.length - 1 ? "text-foreground font-medium" : "text-data-label"
                      }
                    >
                      {c.label}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0 pl-3">
            <span className="flex items-center gap-1.5">
              <span className="size-2 bg-accent-success rounded-full shrink-0" />
              <span className="hidden sm:inline text-[10px] font-mono uppercase text-data-label whitespace-nowrap">
                Engine Status: Ready
              </span>
            </span>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
