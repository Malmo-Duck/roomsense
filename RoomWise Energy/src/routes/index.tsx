import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ScanLine,
  Sun,
  Gauge,
  ShieldCheck,
  Thermometer,
  Building2,
} from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { SkanzaSteps, SkanzaLink } from "@/components/skanza-steps";
import roomwiseLogo from "@/assets/roomwise-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RoomSense: Per-Room Hotel Setback Optimization" },
      {
        name: "description",
        content:
          "RoomSense turns per-room LiDAR scans into optimal HVAC setback setpoints, recovery times and savings estimates, with confidence-scored thermal modeling.",
      },
      {
        property: "og:title",
        content: "RoomSense: Per-Room Hotel Setback Optimization",
      },
      {
        property: "og:description",
        content:
          "One setback temperature for every room wastes energy. RoomSense models each room's real orientation, glazing and volume to set the right one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: ScanLine,
    title: "Scan-derived geometry",
    body: (
      <>
        Parse a <SkanzaLink /> LiDAR record straight into facade bearings, window area, ceiling
        height and room volume, with no manual survey.
      </>
    ),
  },
  {
    icon: Sun,
    title: "Real solar exposure",
    body: "Per-facade sun path and irradiance from the room's own compass orientation, so a south-glazed room isn't treated like a north one.",
  },
  {
    icon: Gauge,
    title: "Setpoint, recovery, savings",
    body: "A single lumped-capacitance heat balance yields the most relaxed safe setback, the recovery burst before check-in and the energy saved.",
  },
  {
    icon: ShieldCheck,
    title: "Confidence, not guesses",
    body: "Every input resolves through a tier. Lose live weather and the recommendation widens its band instead of quietly failing.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-deep text-foreground font-sans">
      <header className="h-14 border-b border-border-subtle flex items-center justify-between px-4 sm:px-8">
        <Wordmark size="sm" asLink />
        <nav className="flex items-center gap-3">
          <Link
            to="/portfolio"
            className="text-[10px] font-mono uppercase tracking-widest text-data-label hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <Link
            to="/upload"
            className="text-[10px] font-mono px-3 py-2 bg-accent-primary text-white rounded hover:bg-blue-500 transition-colors"
          >
            UPLOAD_RECORD
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative px-4 sm:px-8 py-20 sm:py-28 max-w-5xl mx-auto text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 size-72 rounded-full bg-accent-primary/15 blur-3xl"
          />
          <div className="relative flex flex-col items-center">
            <img
              src={roomwiseLogo}
              alt="RoomSense logo"
              width={1024}
              height={1024}
              className="size-24 sm:size-28 drop-shadow-[0_0_35px_color-mix(in_oklab,var(--accent-primary)_45%,transparent)]"
            />
            <Wordmark size="lg" tagline showMark={false} className="mt-5 [&>div]:items-center" />
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-block text-[10px] font-mono uppercase tracking-widest text-accent-primary border border-accent-primary/30 rounded-full px-3 py-1">
              Per-room energy optimization
            </span>
            <a
              href="https://skanza.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[10px] font-mono uppercase tracking-widest text-data-label border border-border-subtle rounded-full px-3 py-1 hover:text-foreground hover:border-accent-primary/40 transition-colors"
            >
              Powered by Skanza scans
            </a>
          </div>
          <h1 className="mt-6 text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            Every room loses heat <span className="text-accent-primary">differently.</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-data-label max-w-2xl mx-auto leading-relaxed">
            RoomSense takes a single LiDAR scan (real orientation, window area, ceiling height, GPS)
            and computes the optimal unoccupied setpoint, the recovery time before check-in, and
            what it saves.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 text-sm font-medium px-5 py-3 bg-accent-primary text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              Upload a scan <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-2 text-sm font-medium px-5 py-3 bg-surface border border-border-subtle rounded-lg hover:border-accent-primary/40 transition-colors"
            >
              View the dashboard
            </Link>
          </div>

          <dl className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { k: "One phone scan", v: "is all a room needs to onboard" },
              { k: "Sensors optional", v: "works without them, better with your PMS or BMS feed" },
              { k: "Free data", v: "public weather and solar, no API keys" },
            ].map((s) => (
              <div key={s.k} className="bg-surface border border-border-subtle rounded-xl p-4">
                <dt className="text-base sm:text-lg font-medium text-foreground">{s.k}</dt>
                <dd className="text-xs text-data-label mt-1 leading-relaxed">{s.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Skanza upload walkthrough */}
        <SkanzaSteps />

        {/* Features */}
        <section className="border-t border-border-subtle px-4 sm:px-8 py-20">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-data-label">
              What the engine does
            </h2>
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="bg-surface border border-border-subtle rounded-xl p-6 hover:border-accent-primary/30 transition-colors"
                >
                  <f.icon className="size-5 text-accent-primary" />
                  <h3 className="mt-4 text-base font-medium text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-data-label leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border-subtle px-4 sm:px-8 py-20">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 text-data-label">
              <Thermometer className="size-4" />
              <Building2 className="size-4" />
              <Gauge className="size-4" />
            </div>
            <h2 className="mt-5 text-2xl sm:text-3xl font-semibold tracking-tight">
              Built for facilities engineering, not guests.
            </h2>
            <p className="mt-3 text-sm text-data-label">
              Roll every room up into one portfolio energy and ESG view, or feed the setpoints
              straight to the BMS.
            </p>
            <Link
              to="/portfolio"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium px-5 py-3 bg-accent-primary text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              Open portfolio <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest text-data-label">
          <span>RoomSense · per-room energy optimization</span>
          <span>Constants are stated assumptions, not measurements.</span>
        </div>
      </footer>
    </div>
  );
}
