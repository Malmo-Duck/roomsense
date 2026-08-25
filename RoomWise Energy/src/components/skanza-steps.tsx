import { useState } from "react";

type Step = {
  n: number;
  title: string;
  body: string;
  /** Drop the real screenshot at public/skanza/1.png etc. and it shows up automatically. */
  src: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "Scan the room",
    body: "Open Skanza on the phone and walk one LiDAR pass around the room.",
    src: "/skanza/1.png",
  },
  {
    n: 2,
    title: "Choose the property and label",
    body: "Pick the hotel from the RoomSense property list, then name the room and set its floor.",
    src: "/skanza/2.png",
  },
  {
    n: 3,
    title: "Send to RoomSense",
    body: "Tap upload. The scan posts straight to RoomSense and opens the room result.",
    src: "/skanza/3.png",
  },
  {
    n: 4,
    title: "Recommendation engine",
    body: "RoomSense derives the location, climate and solar path, then returns the setpoint, recovery time and savings.",
    src: "/skanza/4.png",
  },
];

export function SkanzaLink({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://skanza.app"
      target="_blank"
      rel="noopener noreferrer"
      className={`text-accent-primary underline underline-offset-2 hover:text-foreground transition-colors ${className}`}
    >
      Skanza
    </a>
  );
}

function StepImage({ step }: { step: Step }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="aspect-[9/19] w-full rounded-2xl bg-bg-deep border border-border-subtle grid place-items-center">
        <span className="text-5xl font-mono text-accent-primary/50">{step.n}</span>
      </div>
    );
  }

  return (
    <img
      src={step.src}
      alt={`Skanza step ${step.n}: ${step.title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[9/19] w-full object-cover rounded-2xl bg-bg-deep border border-border-subtle"
    />
  );
}

export function SkanzaSteps() {
  return (
    <section className="border-t border-border-subtle px-4 sm:px-8 py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-data-label">
          From scan to setpoint
        </h2>
        <p className="mt-3 text-sm text-data-label max-w-2xl leading-relaxed">
          <SkanzaLink /> does one job: it scans the room geometry. Everything after that is
          RoomSense. On upload it resolves where the building sits, pulls the local climate record,
          works out how the sun tracks each facade, and turns that into the thermal model that keeps
          the room's setpoint updated.
        </p>

        <ol className="mt-8 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="snap-start shrink-0 w-56 sm:w-60 bg-surface border border-border-subtle rounded-xl p-3"
            >
              <StepImage step={s} />
              <div className="mt-3 px-1 pb-1">
                <span className="text-[10px] font-mono text-accent-primary">
                  {String(s.n).padStart(2, "0")}
                </span>
                <h3 className="mt-1 text-sm font-medium text-foreground">{s.title}</h3>
                <p className="mt-1 text-xs text-data-label leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
