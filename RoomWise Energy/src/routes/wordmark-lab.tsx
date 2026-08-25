import { createFileRoute } from "@tanstack/react-router";
import { Wordmark, type RVariant } from "@/components/wordmark";

export const Route = createFileRoute("/wordmark-lab")({
  head: () => ({
    meta: [
      { title: "Wordmark Lab | RoomSense" },
      { name: "description", content: "Internal preview of RoomSense wordmark R treatments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Lab,
});

const VARIANTS: RVariant[] = ["gradient", "boxed", "outlined", "plain"];

function Lab() {
  return (
    <main className="min-h-screen bg-background p-12 space-y-10">
      <h1 className="font-mono text-xs uppercase tracking-[0.28em] text-data-label">
        Wordmark R variants
      </h1>
      {VARIANTS.map((v) => (
        <section key={v} className="space-y-4 border-b border-border-subtle pb-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent-primary">
            {v}
          </div>
          <Wordmark size="lg" rVariant={v} showMark={false} tagline />
          <Wordmark size="sm" rVariant={v} />
        </section>
      ))}
    </main>
  );
}
