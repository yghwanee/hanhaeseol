import type { StreakInfo } from "@/types/standings";

export function StreakChip({ streak }: { streak: StreakInfo }) {
  // 무승부 또는 1회 연속은 의미가 약해서 표시 안 함
  if (streak.count < 2 || streak.type === "D") {
    return <span className="text-fg-tertiary text-caption1">—</span>;
  }
  const { type, count } = streak;
  const cls =
    type === "W"
      ? "border-brand/40 text-fg-brand-bright"
      : "border-[oklch(0.715_0.220_27_/_0.35)] text-fg-danger";
  const suffix = type === "W" ? "연승" : "연패";
  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-caption1 font-semibold tabular-nums ${cls}`}
    >
      {count}
      {suffix}
    </span>
  );
}
