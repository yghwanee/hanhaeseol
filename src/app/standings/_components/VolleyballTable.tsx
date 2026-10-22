import Image from "next/image";
import Link from "next/link";
import { proxyLogo } from "@/lib/emblem";
import type { VolleyballStanding } from "@/types/standings";
import { Last5Dots } from "./Last5Dots";
import { StreakChip } from "./StreakChip";

/** V리그 순위표. 순위 기준이 승점이라 야구 표(승률·게임차)를 쓰지 않는다. */
export function VolleyballTable({ teams, teamLinks }: { teams: VolleyballStanding[]; teamLinks?: Record<string, string> }) {
  const th = "whitespace-nowrap px-1.5 py-2.5 text-center text-caption2 font-semibold text-fg-secondary sm:text-caption1";
  const td = "px-1.5 py-2 text-center tabular-nums text-fg";
  return (
    <div className="overflow-x-auto rounded-xl border border-line-subtle bg-subtle">
      <table className="w-full min-w-[520px] text-label2 sm:text-label1">
        <thead className="border-b border-line-subtle">
          <tr>
            <th className={th}>순위</th>
            <th className={`${th} text-left`}>팀</th>
            <th className={th}>승점</th>
            <th className={th}>경기</th>
            <th className={th}>승</th>
            <th className={th}>패</th>
            <th className={th}>세트득실률</th>
            <th className={th}>최근 5</th>
            <th className={th}>연속</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.teamName} className="border-b border-line-subtle last:border-b-0">
              <td className={`${td} font-bold text-fg-strong`}>{t.rank}</td>
              <td className="px-1.5 py-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {t.teamLogo ? (
                    <Image
                      src={proxyLogo(t.teamLogo)}
                      alt={t.teamName}
                      width={22}
                      height={22}
                      className="h-[18px] w-[18px] shrink-0 object-contain sm:h-[22px] sm:w-[22px]"
                      unoptimized
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="inline-block h-[18px] w-[18px] shrink-0 rounded-full bg-muted sm:h-[22px] sm:w-[22px]" />
                  )}
                  {teamLinks?.[t.teamName] ? (
                    <Link href={teamLinks[t.teamName]} className="truncate font-medium text-fg-strong hover:text-fg-brand-bright hover:underline underline-offset-2">
                      {t.teamName}
                    </Link>
                  ) : (
                    <span className="truncate font-medium text-fg-strong">{t.teamName}</span>
                  )}
                </div>
              </td>
              <td className={`${td} font-bold text-fg-brand-bright`}>{t.points}</td>
              <td className={td}>{t.gameCount}</td>
              <td className={td}>{t.win}</td>
              <td className={td}>{t.lose}</td>
              <td className={td}>{t.setRatio.toFixed(3)}</td>
              <td className="px-2 py-2 text-center">
                <Last5Dots lastFive={t.lastFive} />
              </td>
              <td className="px-1 py-2 text-center">
                <StreakChip streak={t.streak} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
