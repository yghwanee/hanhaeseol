import Link from "next/link";
import { Schedule } from "@/types/schedule";
import { LEAGUE_SEO, PLATFORM_SEO, SeoMeta } from "@/lib/slugs";

const GAME_DURATION_HOURS: Record<string, number> = {
  "축구": 2.5,
  "야구": 4.5,
  "농구": 3,
  "배구": 3,
};

function isGameFinished(date: string, time: string, sport: string): boolean {
  const [hh, mm] = time.split(":").map(Number);
  const gameStart = new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`);
  const duration = (GAME_DURATION_HOURS[sport] ?? 3) * 60 * 60 * 1000;
  return Date.now() > gameStart.getTime() + duration;
}

function StatusPill({ kc }: { kc: boolean | "unknown" }) {
  if (kc === true) {
    return <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">한국어해설</span>;
  }
  if (kc === false) {
    return <span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-400 ring-1 ring-rose-500/30">현지해설</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-[11px] font-semibold text-yellow-400 ring-1 ring-yellow-500/30">확인중</span>;
}

type Props = {
  meta: SeoMeta;
  kind: "league" | "platform";
  schedules: Schedule[];
};

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateHeader(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${m}월 ${d}일 (${DAY_NAMES[dt.getUTCDay()]})`;
}

export default function FilteredScheduleView({ meta, kind, schedules }: Props) {
  const filtered = schedules
    .filter((s) => meta.match.includes(kind === "league" ? s.league : s.platform))
    .filter((s) => !isGameFinished(s.date, s.time, s.sport))
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));

  const grouped = filtered.reduce<Record<string, Schedule[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  const related = kind === "league" ? LEAGUE_SEO : PLATFORM_SEO;

  return (
    <main className="relative mx-auto min-h-screen max-w-2xl px-3 sm:px-4 pb-8 sm:pb-12 pt-6 sm:pt-10">
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-300">홈</Link>
        <span className="mx-1.5">›</span>
        <span className="text-zinc-300">{kind === "league" ? "리그" : "플랫폼"}별 편성표</span>
        <span className="mx-1.5">›</span>
        <span className="text-zinc-200">{meta.display}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          {meta.display} {kind === "league" ? "중계 편성표" : "편성표"}
        </h1>
        <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{meta.intro}</p>
      </header>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-zinc-200">
            예정 경기 ({filtered.length}건)
          </h2>
          <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2">
            전체 편성표 보기 →
          </Link>
        </div>

        {dates.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center text-sm text-zinc-400">
            이번 주 예정된 경기가 없습니다.
            <br />
            <Link href="/" className="mt-2 inline-block text-zinc-300 underline underline-offset-2">
              전체 편성표 확인하기
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {dates.map((date) => (
              <div key={date}>
                <h3 className="mb-2 text-sm font-semibold text-zinc-300">{formatDateHeader(date)}</h3>
                <div className="space-y-2">
                  {grouped[date].map((s) => (
                    <article
                      key={s.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 sm:p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-zinc-400">
                          <span className="font-mono font-semibold text-zinc-200">{s.time}</span>
                          <span className="text-zinc-600">|</span>
                          <span className="truncate">{s.league}</span>
                        </div>
                        <StatusPill kc={s.koreanCommentary} />
                      </div>
                        {s.awayTeam ? (
                          <div className="mt-2.5 flex items-center justify-center gap-2 text-sm sm:text-base">
                            <span className="flex-1 text-right font-semibold text-zinc-100 truncate">{s.homeTeam}</span>
                            <span className="shrink-0 text-[10px] font-bold text-zinc-500">VS</span>
                            <span className="flex-1 text-left font-semibold text-zinc-100 truncate">{s.awayTeam}</span>
                          </div>
                        ) : (
                          <div className="mt-2.5 text-center text-sm sm:text-base font-semibold text-zinc-100 truncate">{s.homeTeam}</div>
                        )}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] sm:text-xs">
                          <span className="text-zinc-400">{s.platform}</span>
                          <span className="text-zinc-500">{s.sport}</span>
                        </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">
          다른 {kind === "league" ? "리그" : "플랫폼"} 보기
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {related
            .filter((r) => r.slug !== meta.slug)
            .map((r) => (
              <Link
                key={r.slug}
                href={`/${kind}/${r.slug}`}
                className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700/60 hover:text-white"
              >
                {r.display}
              </Link>
            ))}
        </div>
      </section>

      <footer className="border-t border-zinc-800 pt-6 text-center text-xs text-zinc-500">
        <Link href="/" className="text-zinc-300 hover:text-white">← 메인으로 돌아가기</Link>
      </footer>
    </main>
  );
}
