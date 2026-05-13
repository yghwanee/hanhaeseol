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
      <section className="mb-6 rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-zinc-100 sm:text-lg">{title}</h2>
        <p className="text-sm text-zinc-400">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-4 sm:p-5">
      <h2 className="mb-3 text-base font-semibold text-zinc-100 sm:text-lg">{title}</h2>
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
  return (
    <Link
      href={`/match/${matchToSlug(s)}`}
      className="flex h-full flex-col rounded-lg border border-zinc-800 border-l-2 border-l-emerald-500/50 bg-zinc-900/80 p-3 transition-colors hover:border-zinc-600 hover:border-l-emerald-400 hover:bg-zinc-900 sm:p-3.5"
    >
      <div className="flex items-baseline gap-1.5 text-xs text-zinc-400">
        <span>{formatDateHeader(s.date)}</span>
        <span className="font-mono font-semibold text-zinc-200">{s.time}</span>
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold text-zinc-100 sm:text-[15px]">
        {versus}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span className="truncate">{s.league}</span>
        <span className="shrink-0">{s.platform}</span>
      </div>
    </Link>
  );
}
