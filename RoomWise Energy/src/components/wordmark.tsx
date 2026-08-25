import { Link } from "@tanstack/react-router";
import roomwiseLogo from "@/assets/roomwise-logo.png";
import { cn } from "@/lib/utils";

export const APP_VERSION = "v1.0";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { mark: string; text: string; gap: string; rule: string }> = {
  sm: { mark: "size-6", text: "text-[15px]", gap: "gap-2", rule: "h-3" },
  md: { mark: "size-8", text: "text-xl", gap: "gap-2.5", rule: "h-4" },
  lg: { mark: "size-12", text: "text-3xl sm:text-4xl", gap: "gap-3.5", rule: "h-6" },
};

/** Treatment applied to the capital R. */
export type RVariant = "gradient" | "boxed" | "outlined" | "plain";

interface WordmarkProps {
  size?: Size;
  /** Show the version chip after the wordmark. */
  version?: boolean;
  /** Show the "thermal intelligence" descender line under the wordmark. */
  tagline?: boolean;
  /** Wrap the lockup in a link back to the landing page. */
  asLink?: boolean;
  /** Render the logo mark alongside the text. */
  showMark?: boolean;
  /** How the leading capital R is styled. */
  rVariant?: RVariant;
  className?: string;
}

/**
 * RoomSense wordmark lockup.
 *
 * Typography: Space Grotesk (display) at tight tracking. A capital R leads,
 * "oom" in medium neutral and "Sense" in bold accent, so the mark reads as one
 * word but carries the product's split meaning. A hairline rule separates the
 * version chip so the lockup stays legible at 24px in the sidebar.
 */
export function Wordmark({
  size = "sm",
  version = true,
  tagline = false,
  asLink = false,
  showMark = true,
  rVariant = "gradient",
  className,
}: WordmarkProps) {
  const s = SIZES[size];
  const cls = cn(
    "flex items-center",
    s.gap,
    asLink &&
      "rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60",
    className,
  );

  const rCls: Record<RVariant, string> = {
    // Gradient cap that mirrors the "wise" accent, slightly oversized.
    gradient:
      "font-bold text-[1.12em] bg-gradient-to-br from-accent-primary to-accent-success bg-clip-text text-transparent",
    // Solid accent tile, like a room key card.
    boxed:
      "font-bold text-[0.9em] mr-[0.12em] inline-flex items-center justify-center align-baseline rounded-[0.22em] px-[0.18em] pb-[0.02em] bg-gradient-to-br from-accent-primary to-accent-success text-background",
    // Hairline-outlined cap, blueprint feel.
    outlined:
      "font-bold text-[1.12em] text-transparent [-webkit-text-stroke:1.5px_var(--color-accent-primary)]",
    plain: "font-medium text-foreground",
  };

  const inner = (
    <>
      {showMark && (
        <img
          src={roomwiseLogo}
          alt="RoomSense logo"
          width={1024}
          height={1024}
          className={cn(s.mark, "shrink-0")}
        />
      )}
      <div className="flex flex-col">
        <div className={cn("flex items-center", s.gap)}>
          <span className={cn("font-display leading-none tracking-[-0.045em] select-none", s.text)}>
            <span className={rCls[rVariant]}>R</span>
            <span className="font-medium text-foreground lowercase">oom</span>
            <span className="font-bold bg-gradient-to-r from-accent-primary to-accent-success bg-clip-text text-transparent">
              Sense
            </span>
          </span>
          {version && (
            <>
              <span className={cn("w-px bg-border-subtle", s.rule)} aria-hidden />
              <span className="font-mono text-[9px] tracking-[0.18em] text-data-label">
                {APP_VERSION}
              </span>
            </>
          )}
        </div>
        {tagline && (
          <span className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.28em] text-data-label">
            Room-level thermal intelligence
          </span>
        )}
      </div>
    </>
  );

  if (asLink) {
    return (
      <Link to="/" aria-label="RoomSense home" className={cls}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}
