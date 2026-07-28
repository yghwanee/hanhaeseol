"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { proxyLogo } from "@/lib/emblem";
import type { SoccerStanding } from "@/types/standings";
import { Last5Dots } from "./Last5Dots";
import { StreakChip } from "./StreakChip";
import { rankStatusStyle, uniqueRankStatuses } from "./rankStatus";

const CONFERENCES: { conference: "EAST" | "WEST"; label: string }[] = [
  { conference: "EAST", label: "Eastern Conference" },
  { conference: "WEST", label: "Western Conference" },
];

export function MlsStandingsTable({ teams, teamLinks }: { teams: SoccerStanding[]; teamLinks?: Record<string, string> }) {
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
        <ConferenceTable key={g.conference} label={g.label} teams={g.teams} teamLinks={teamLinks} />
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
  teamLinks,
}: {
  label: string;
  teams: SoccerStanding[];
  teamLinks?: Record<string, string>;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let rafId = 0;
    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      setShowLeftFade(maxScroll > 2 && el.scrollLeft > 2);
      setShowRightFade(maxScroll > 2 && el.scrollLeft < maxScroll - 2);
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        update();
      });
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => update();
    window.addEventListener("resize", onResize);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [teams]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/50">
      <div className="border-b border-zinc-800/80 px-3 py-2 sm:px-4">
        <h3 className="text-sm font-semibold text-white sm:text-base">{label}</h3>
      </div>
      <div className="relative">
      <div ref={scrollerRef} className="overflow-x-auto scrollbar-hide">
        <table className="w-full min-w-[670px] table-fixed text-[12px] sm:text-sm">
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
          <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur">
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <Th label="순위" className="sticky left-0 z-20 bg-zinc-900" />
              <th className="sticky left-10 z-20 whitespace-nowrap bg-zinc-900 px-1.5 py-2.5 text-left text-[11px] font-semibold text-zinc-400 sm:left-12 sm:px-2 sm:text-xs">
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
                  className="group border-b border-zinc-800/60 transition-colors duration-150 last:border-b-0 hover:bg-zinc-900/50"
                >
                  <td className="sticky left-0 z-10 bg-zinc-950 px-1 py-2 text-center transition-colors group-hover:bg-[#1a1a1d]">
                    {st && (
                      <span
                        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${st.bar}`}
                        aria-hidden
                      />
                    )}
                    <span className="font-bold tabular-nums text-zinc-100">{t.rank}</span>
                  </td>
                  <td className="sticky left-10 z-10 bg-zinc-950 px-1.5 py-2 transition-colors group-hover:bg-[#1a1a1d] sm:left-12 sm:px-2">
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
                        <span className="inline-block h-[18px] w-[18px] shrink-0 rounded-full bg-zinc-800 sm:h-[22px] sm:w-[22px]" />
                      )}
                      {teamLinks?.[t.teamName] ? (
                        <Link
                          href={teamLinks[t.teamName]}
                          className="truncate font-medium text-zinc-100 hover:text-emerald-400 hover:underline underline-offset-2"
                        >
                          {t.teamName}
                        </Link>
                      ) : (
                        <span className="truncate font-medium text-zinc-100">{t.teamName}</span>
                      )}
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
      <div
        className={`pointer-events-none absolute left-[180px] top-0 bottom-0 w-10 bg-gradient-to-r from-zinc-950 via-zinc-950/70 to-transparent transition-opacity duration-200 sm:left-[248px] ${
          showLeftFade ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-zinc-950 via-zinc-950/70 to-transparent transition-opacity duration-200 ${
          showRightFade ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
      </div>
    </div>
  );
}

function Th({
  label,
  highlight = false,
  className = "",
}: {
  label: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-1 py-2.5 text-center align-middle text-[11px] font-semibold sm:text-xs ${
        highlight ? "text-emerald-300" : "text-zinc-400"
      } ${className}`}
    >
      {label}
    </th>
  );
}
