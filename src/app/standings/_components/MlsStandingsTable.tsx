"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { SoccerStanding } from "@/types/standings";
import { Last5Dots } from "./Last5Dots";
import { StreakChip } from "./StreakChip";
import { rankStatusStyle, uniqueRankStatuses } from "./rankStatus";

const CONFERENCES: { conference: "EAST" | "WEST"; label: string }[] = [
  { conference: "EAST", label: "Eastern Conference" },
  { conference: "WEST", label: "Western Conference" },
];

export function MlsStandingsTable({ teams }: { teams: SoccerStanding[] }) {
  const groups = useMemo(() => {
    return CONFERENCES.map((c) => ({
      ...c,
      teams: teams
        .filter((t) => t.conference === c.conference)
        .sort((a, b) => a.rank - b.rank),
    })).filter((g) => g.teams.length > 0);
  }, [teams]);

  const legend = uniqueRankStatuses(teams.map((t) => t.rankStatus));

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <ConferenceTable key={g.conference} label={g.label} teams={g.teams} />
      ))}
      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5 text-[10px] text-zinc-400 sm:px-4 sm:text-[11px]">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className={`inline-block h-3 w-[3px] rounded-sm ${l.bar}`} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ConferenceTable({
  label,
  teams,
}: {
  label: string;
  teams: SoccerStanding[];
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50">
      <div className="border-b border-zinc-800/80 px-3 py-2 sm:px-4">
        <h3 className="text-sm font-semibold text-white sm:text-base">{label}</h3>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full min-w-[670px] text-[12px] sm:text-sm">
          <colgroup>
            <col className="w-10 sm:w-12" />
            <col className="w-[140px] sm:w-[200px]" />
            <col className="w-12" />
            <col className="w-12" />
            <col className="w-10" />
            <col className="w-10" />
            <col className="w-10" />
            <col className="w-10 sm:w-12" />
            <col className="w-10 sm:w-12" />
            <col className="w-12 sm:w-14" />
            <col className="w-24 sm:w-28" />
            <col className="w-16 sm:w-20" />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <Th label="순위" />
              <th className="whitespace-nowrap px-1.5 py-2.5 text-left text-[11px] font-semibold text-zinc-400 sm:px-2 sm:text-xs">
                팀
              </th>
              <Th label="승점" highlight />
              <Th label="경기" />
              <Th label="승" />
              <Th label="무" />
              <Th label="패" />
              <Th label="득" />
              <Th label="실" />
              <Th label="득실" />
              <th className="whitespace-nowrap px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 sm:text-xs">
                최근 5
              </th>
              <th className="whitespace-nowrap px-1 py-2.5 text-center text-[11px] font-semibold text-zinc-400 sm:text-xs">
                연속
              </th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const st = rankStatusStyle(t.rankStatus);
              return (
                <tr
                  key={t.teamName}
                  className="border-b border-zinc-800/60 transition-colors duration-150 last:border-b-0 hover:bg-zinc-900/50"
                >
                  <td className="relative px-1 py-2 text-center">
                    {st && (
                      <span
                        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${st.bar}`}
                        aria-hidden
                      />
                    )}
                    <span className="font-bold tabular-nums text-zinc-100">{t.rank}</span>
                  </td>
                  <td className="px-1.5 py-2 sm:px-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {t.teamLogo ? (
                        <Image
                          src={t.teamLogo}
                          alt={t.teamName}
                          width={22}
                          height={22}
                          className="h-[18px] w-[18px] shrink-0 object-contain sm:h-[22px] sm:w-[22px]"
                          unoptimized
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="inline-block h-[18px] w-[18px] shrink-0 rounded-full bg-zinc-800 sm:h-[22px] sm:w-[22px]" />
                      )}
                      <span className="truncate font-medium text-zinc-100">{t.teamName}</span>
                    </div>
                  </td>
                  <td className="px-1 py-2 text-center font-bold tabular-nums text-emerald-400">
                    {t.points}
                  </td>
                  <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.matchesPlayed}</td>
                  <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.wins}</td>
                  <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.draws}</td>
                  <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.losses}</td>
                  <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.goals}</td>
                  <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.goalsConceded}</td>
                  <td className="px-1 py-2 text-center font-medium tabular-nums text-zinc-300">
                    {t.goalsDifference > 0 ? `+${t.goalsDifference}` : t.goalsDifference}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Last5Dots lastFive={t.lastFive} />
                  </td>
                  <td className="px-1 py-2 text-center">
                    <StreakChip streak={t.streak} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ label, highlight = false }: { label: string; highlight?: boolean }) {
  return (
    <th
      className={`whitespace-nowrap px-1 py-2.5 text-center align-middle text-[11px] font-semibold sm:text-xs ${
        highlight ? "text-emerald-300" : "text-zinc-400"
      }`}
    >
      {label}
    </th>
  );
}
