import type { Schedule } from "@/types/schedule";
import { describeMatch, pickWeekHighlights } from "@/lib/highlight-summary";

type Props = {
  title: string;
  schedules: Schedule[];
  league?: string[];
  platform?: string[];
  max?: number;
  emptyText?: string;
  intro?: string;
};

export default function WeekHighlights({
  title,
  schedules,
  league,
  platform,
  max = 5,
  emptyText,
  intro,
}: Props) {
  const picks = pickWeekHighlights(schedules, { league, platform, max });

  if (picks.length === 0) {
    if (!emptyText) return null;
    return (
      <section className="mb-6 rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-4 sm:p-5">
        <h2 className="text-base sm:text-lg font-semibold text-zinc-100 mb-3">{title}</h2>
        <p className="text-sm text-zinc-400">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-4 sm:p-5">
      <h2 className="text-base sm:text-lg font-semibold text-zinc-100 mb-3">{title}</h2>
      {intro && (
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-3">{intro}</p>
      )}
      <ul className="space-y-2">
        {picks.map((s) => (
          <li
            key={s.id}
            className="text-sm text-zinc-300 leading-relaxed flex items-start gap-2"
          >
            <span
              aria-hidden
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                s.koreanCommentary === true
                  ? "bg-emerald-400"
                  : s.koreanCommentary === false
                    ? "bg-rose-400"
                    : "bg-yellow-400"
              }`}
            />
            <span>{describeMatch(s)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
