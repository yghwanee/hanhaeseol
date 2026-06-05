import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { loadWorldcupStandings, loadScheduleData } from "@/lib/server-data";
import type { WorldCupGroup } from "@/types/worldcup";
import { WorldCupBanner } from "@/app/_components/WorldCupBanner";
import { StickyHeader } from "@/app/_components/StickyHeader";

export const metadata: Metadata = {
  title: "북중미 월드컵 조별 순위 | 한해설",
  description:
    "2026 FIFA 북중미 월드컵 12개 조 순위·승점·골득실·16강 진출 확률을 한곳에서. 조 1·2위 16강 직행.",
};

/** 오늘(로컬)부터 첫 경기까지 D-day. */
function computeDday(): number | null {
  const wcDates = loadScheduleData()
    .schedules.filter((s) => s.league.startsWith("북중미 월드컵"))
    .map((s) => s.date)
    .sort();
  if (wcDates.length === 0) return null;
  const d = new Date();
  const a = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  const [by, bm, bd] = wcDates[0].split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

function GroupCard({ g }: { g: WorldCupGroup }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="bg-zinc-800/60 px-3 py-1.5 text-xs font-bold text-zinc-200">{g.group}조</div>
      <div className="overflow-x-auto">
        {/* table-fixed + 고정폭 → 팀명 길이와 무관하게 모든 조가 동일한 컬럼 위치로 정렬 */}
        <table className="w-full min-w-[360px] table-fixed text-[10px] sm:text-xs">
          <thead>
            <tr className="text-zinc-500">
              <th className="w-6 py-1.5 pl-2 text-center font-medium" />
              <th className="py-1.5 text-left font-medium">팀</th>
              <th className="w-9 px-1 py-1.5 text-center font-bold text-zinc-300">승점</th>
              <th className="w-9 px-1 py-1.5 text-center font-medium">경기</th>
              <th className="w-7 px-1 py-1.5 text-center font-medium">승</th>
              <th className="w-7 px-1 py-1.5 text-center font-medium">무</th>
              <th className="w-7 px-1 py-1.5 text-center font-medium">패</th>
              <th className="w-9 px-1 py-1.5 text-center font-medium">득점</th>
              <th className="w-9 px-1 py-1.5 text-center font-medium">실점</th>
              <th className="w-10 px-1 py-1.5 pr-2 text-center font-medium">득실</th>
            </tr>
          </thead>
          <tbody>
            {g.teams.map((t) => {
              const advance = t.rank <= 2;
              return (
                <tr key={t.name} className={`border-t border-zinc-800/70 ${advance ? "bg-amber-400/[0.05]" : ""}`}>
                  <td className="py-1.5 pl-2 text-center font-bold">
                    <span className={advance ? "text-amber-300" : "text-zinc-500"}>{t.rank}</span>
                  </td>
                  <td className="py-1.5 pr-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {t.emblem && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={t.emblem} alt="" referrerPolicy="no-referrer" className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" />
                      )}
                      <span className="truncate font-medium text-zinc-100">{t.name}</span>
                    </span>
                  </td>
                  <td className="px-1 py-1.5 text-center font-bold text-zinc-100">{t.points}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.played}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.win}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.draw}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.loss}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.gf}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.ga}</td>
                  <td className="px-1 py-1.5 pr-2 text-center text-zinc-400">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WorldCupPage() {
  const standings = loadWorldcupStandings();
  const dday = computeDday();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-3 pb-12 sm:px-4">
      <StickyHeader>
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-end">
            <Image src="/icon.png" alt="한해설 아이콘" width={32} height={32} className="h-6 w-6 sm:h-8 sm:w-8 self-center" />
            <span className="ml-1 sm:ml-2 text-xl sm:text-3xl font-bold text-white">한해설</span>
            <span className="ml-2 sm:ml-3 text-sm sm:text-lg font-normal text-zinc-500">한국어중계 편성표</span>
          </Link>
          <Link href="/?sport=북중미 월드컵" className="btn-caps-stripe inline-flex items-center justify-center whitespace-nowrap px-4 py-1.5 text-[11px] font-medium sm:px-5 sm:py-2 sm:text-xs">
            ← &ensp;편성표
          </Link>
        </header>
      </StickyHeader>

      <div className="mt-4 sm:mt-6">
        <WorldCupBanner dday={dday} href="/?sport=북중미 월드컵" />
      </div>

      <h1 className="mb-3 text-base font-bold text-zinc-100 sm:text-lg">조별 순위</h1>

      {!standings ? (
        <p className="py-16 text-center text-sm text-zinc-500">순위 데이터가 아직 준비되지 않았습니다.</p>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {standings.groups.map((g) => (
            <GroupCard key={g.group} g={g} />
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-600">
        조 1·2위 16강 직행 + 각 조 3위 중 상위 8팀 추가 진출 · 순위 출처: 네이버 스포츠
      </p>
    </main>
  );
}
