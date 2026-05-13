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
        <h2 className="text-base sm:text-lg font-semibold text-zinc-100 mb-3">{title}</h2>
        <p className="text-sm text-zinc-400">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-4 sm:p-5">
      <h2 className="text-base sm:text-lg font-semibold text-zinc-100 mb-3">{title}</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
      className="flex h-full flex-col rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
    >
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span className="font-mono font-semibold text-zinc-200">
          {formatDateHeader(s.date)} · {s.time}
        </span>
        {s.koreanCommentary === true && (
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
            한국어해설
          </span>
        )}
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold text-zinc-100">
        {versus}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span className="truncate">{s.league}</span>
        <span className="shrink-0">{s.platform}</span>
      </div>
    </Link>
  );
}
