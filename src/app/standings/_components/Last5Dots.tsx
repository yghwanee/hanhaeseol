"use client";

/** "WWWLL" — index 0이 가장 최근 경기 */
export function Last5Dots({ lastFive }: { lastFive: string }) {
  const slots = lastFive.padEnd(5, "-").slice(0, 5).split("");
  return (
    <div className="inline-flex items-center gap-0.5 sm:gap-1">
      {slots.map((g, i) => {
        const cls =
          g === "W"
            ? "bg-emerald-500/85 text-fg-disabled"
            : g === "L"
            ? "bg-rose-500/85 text-fg-disabled"
            : g === "D"
            ? "bg-fg-tertiary text-fg-strong"
            : "bg-muted text-fg-disabled";
        const label =
          g === "W" ? "승" : g === "L" ? "패" : g === "D" ? "무" : "-";
        return (
          <span
            key={i}
            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none sm:h-5 sm:w-5 sm:text-[10px] ${cls}`}
            title={`${5 - i}경기 전: ${label}`}
            aria-label={`${5 - i}경기 전: ${label}`}
          >
            {g === "-" ? "" : g}
          </span>
        );
      })}
    </div>
  );
}
