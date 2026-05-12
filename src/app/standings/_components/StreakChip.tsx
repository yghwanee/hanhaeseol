import type { StreakInfo } from "@/types/standings";

export function StreakChip({ streak }: { streak: StreakInfo }) {
  if (streak.count === 0) {
    return <span className="text-zinc-600 text-xs">—</span>;
  }
  const { type, count } = streak;
  const cls =
    type === "W"
      ? "border-emerald-500/40 text-emerald-400"
      : type === "L"
      ? "border-rose-500/40 text-rose-400"
      : "border-zinc-500/40 text-zinc-400";
  const suffix = type === "W" ? "연승" : type === "L" ? "연패" : "연무";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums ${cls}`}
    >
      {count}
      {suffix}
    </span>
  );
}
