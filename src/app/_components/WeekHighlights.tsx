import Link from "next/link";
import type { Schedule } from "@/types/schedule";
import { pickWeekHeroMatches } from "@/lib/highlight-summary";
import { formatDateHeader } from "@/lib/schedule-utils";
import { matchToSlug } from "@/lib/match-slug";

type Props = {
  title: string;
  schedules: Schedule[];
  league?: string[];
  platform?: string[];
  /** 며칠치를 보여줄지 (기본 7). */
  days?: number;
  emptyText?: string;
};

export default function WeekHighlights({
  title,
  schedules,
  league,
  platform,
  days = 7,
  emptyText,
}: Props) {
  const picks = pickWeekHeroMatches(schedules, { league, platform, days });

  if (picks.length === 0) {
    if (!emptyText) return null;
    return (
      <section className="mb-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-fg-strong sm:text-lg">{title}</h2>
        <p className="text-sm text-fg-secondary">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-3 text-base font-semibold text-fg-strong sm:text-lg">{title}</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {picks.map((s) => (
          <li key={s.id}>
            <MiniMatchCard schedule={s} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MiniMatchCard({ schedule: s }: { schedule: Schedule }) {
  const versus = s.awayTeam ? `${s.homeTeam} vs ${s.awayTeam}` : s.homeTeam;
  const dayOfWeek = new Date(s.date + "T00:00:00").getDay();
  const dateColor =
    dayOfWeek === 0
      ? "text-fg-danger"
      : dayOfWeek === 6
        ? "text-fg-brand"
        : "text-fg-secondary";
  return (
    <Link
      href={`/match/${matchToSlug(s)}`}
      className="flex h-full flex-col rounded-lg border border-line-subtle border-l-2 border-l-emerald-500/50 bg-surface p-3 transition-colors hover:border-line hover:border-l-emerald-400 hover:bg-surface sm:p-3.5"
    >
      <div className="flex items-baseline gap-1.5 text-xs">
        <span className={dateColor}>{formatDateHeader(s.date)}</span>
        <span className="font-mono font-semibold text-fg-strong">{s.time}</span>
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold text-fg-strong sm:text-[15px]">
        {versus}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-fg-tertiary">
        <span className="truncate">{s.league}</span>
        <span className="shrink-0">{s.platform}</span>
      </div>
    </Link>
  );
}
