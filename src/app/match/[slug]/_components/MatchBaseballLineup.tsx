"use client";

import { useEffect, useState } from "react";

interface BaseballBatter {
  order: number;
  name: string;
  position: string;
  backnum: string | null;
  bats: string;
}
interface BaseballTeamLineup {
  starter: { name: string; backnum: string | null } | null;
  batters: BaseballBatter[];
}
interface LineupResponse {
  home: BaseballTeamLineup | null;
  away: BaseballTeamLineup | null;
}

function TeamColumn({ team, label }: { team: BaseballTeamLineup; label: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 truncate text-sm font-semibold text-white">{label}</div>
      {team.starter && (
        <div className="mb-2 flex items-center gap-1.5 rounded bg-zinc-800/60 px-2 py-1 text-[11px] sm:text-xs">
          <span className="shrink-0 text-emerald-400">선발</span>
          <span className="truncate text-zinc-200">{team.starter.name}</span>
          {team.starter.backnum && (
            <span className="shrink-0 font-mono text-[10px] text-zinc-500">
              #{team.starter.backnum}
            </span>
          )}
        </div>
      )}
      <ol className="space-y-0.5 text-[11px] sm:text-xs">
        {team.batters.map((b) => (
          <li key={b.order} className="flex items-center gap-1.5">
            <span className="inline-block w-3 shrink-0 text-center font-mono text-zinc-500">
              {b.order}
            </span>
            <span className="truncate text-zinc-200">{b.name}</span>
            <span className="shrink-0 text-[10px] text-zinc-500">{b.position}</span>
            {b.bats && <span className="shrink-0 text-[10px] text-zinc-600">{b.bats}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * 야구 선발 라인업(타순 1~9 + 선발투수). KBO·MLB 모두 /api/lineup-baseball에서 정규화.
 * 라인업이 아직 발표 전이면(빈 응답) 섹션을 숨긴다(graceful). 야구 경기에서만 부모가 렌더.
 */
export function MatchBaseballLineup({
  gameId,
  homeTeam,
  awayTeam,
}: {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
}) {
  const [data, setData] = useState<LineupResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/lineup-baseball?gameId=${encodeURIComponent(gameId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: LineupResponse | null) => {
        if (alive) setData(j);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [gameId]);

  const hasAny =
    !!data && ((data.home?.batters.length ?? 0) > 0 || (data.away?.batters.length ?? 0) > 0);
  if (loading || !hasAny) return null;

  return (
    <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-white sm:text-base">선발 라인업 (타순)</h2>
      <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8">
        {data!.home ? (
          <TeamColumn team={data!.home} label={homeTeam} />
        ) : (
          <div className="text-xs text-zinc-600">정보 없음</div>
        )}
        {data!.away ? (
          <TeamColumn team={data!.away} label={awayTeam} />
        ) : (
          <div className="text-xs text-zinc-600">정보 없음</div>
        )}
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">출처: 네이버 스포츠 · 발표 후 표시</p>
    </section>
  );
}
