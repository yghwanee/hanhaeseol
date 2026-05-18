import Link from "next/link";
import type { Schedule } from "@/types/schedule";
import { formatDateHeader } from "@/lib/schedule-utils";
import { matchToSlug } from "@/lib/match-slug";

type Props = {
  schedules: Schedule[];
  /** standings 페이지에 표시할 리그명 (예: "프리미어리그 (EPL)") */
  display: string;
  /** schedule.json의 league 값과 매칭할 키 목록 (LEAGUE_SEO.match) */
  matchKeys: string[];
  /** "/league/{slug}" 전체 편성표 링크용 슬러그 */
  scheduleSlug: string;
  /** 표시 일수 (기본 7) */
  days?: number;
};

function getDateRange(days: number): { from: string; to: string } {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const fy = kst.getUTCFullYear();
  const fm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const fd = String(kst.getUTCDate()).padStart(2, "0");
  const from = `${fy}-${fm}-${fd}`;
  const end = new Date(kst);
  end.setUTCDate(end.getUTCDate() + days);
  const ty = end.getUTCFullYear();
  const tm = String(end.getUTCMonth() + 1).padStart(2, "0");
  const td = String(end.getUTCDate()).padStart(2, "0");
  return { from, to: `${ty}-${tm}-${td}` };
}

export default function UpcomingScheduleForLeague({
  schedules,
  display,
  matchKeys,
  scheduleSlug,
  days = 7,
}: Props) {
  const { from, to } = getDateRange(days);
  const matched = schedules
    .filter((s) => matchKeys.includes(s.league))
    .filter((s) => s.date >= from && s.date < to)
    .sort((a, b) =>
      a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
    );

  const grouped = matched.reduce<Record<string, Schedule[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  return (
    <section className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-white sm:text-lg">
          이번 주 {display} 한국어 해설 중계 일정
        </h2>
        <Link
          href={`/league/${scheduleSlug}`}
          className="shrink-0 whitespace-nowrap text-xs font-semibold text-emerald-400 hover:text-emerald-300 sm:text-sm"
        >
          전체 편성표 →
        </Link>
      </div>

      {dates.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-center text-sm text-zinc-400">
          이번 주 예정된 {display} 경기가 없습니다.
        </p>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => (
            <div key={date}>
              <h3 className="mb-2 text-xs font-semibold text-zinc-400 sm:text-sm">
                {formatDateHeader(date)}
              </h3>
              <ul className="space-y-1.5">
                {grouped[date].map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/match/${matchToSlug(s)}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
                    >
                      <div className="flex min-w-0 items-baseline gap-2 text-xs sm:text-sm">
                        <span className="shrink-0 font-mono font-semibold text-zinc-200">
                          {s.time}
                        </span>
                        <span className="truncate text-zinc-100">
                          {s.awayTeam
                            ? `${s.homeTeam} vs ${s.awayTeam}`
                            : s.homeTeam}
                        </span>
                      </div>
                      <span className="shrink-0 text-[11px] text-zinc-500 sm:text-xs">
                        {s.platform}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
