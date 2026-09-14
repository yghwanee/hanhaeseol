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
      <div className="mb-2 truncate text-label1 font-semibold text-fg-strong">{label}</div>
      {team.starter && (
        <div className="mb-2 flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-caption2 sm:text-caption1">
          <span className="shrink-0 text-fg-brand-bright">선발</span>
          <span className="truncate text-fg-strong">{team.starter.name}</span>
          {team.starter.backnum && (
            <span className="shrink-0 tabular-nums text-caption2 text-fg-tertiary">
              #{team.starter.backnum}
            </span>
          )}
        </div>
      )}
      <ol className="space-y-0.5 text-caption2 sm:text-caption1">
        {team.batters.map((b) => (
          <li key={b.order} className="flex items-center gap-1.5">
            <span className="inline-block w-3 shrink-0 text-center tabular-nums text-fg-tertiary">
              {b.order}
            </span>
            <span className="truncate text-fg-strong">{b.name}</span>
            <span className="shrink-0 text-caption2 text-fg-tertiary">{b.position}</span>
            {b.bats && <span className="shrink-0 text-caption2 text-fg-secondary">{b.bats}</span>}
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
    <section className="mt-6 rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
      <h2 className="mb-3 text-label1 font-semibold text-fg-strong sm:text-headline1">선발 라인업 (타순)</h2>
      <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8">
        {data!.home ? (
          <TeamColumn team={data!.home} label={homeTeam} />
        ) : (
          <div className="text-caption1 text-fg-secondary">정보 없음</div>
        )}
        {data!.away ? (
          <TeamColumn team={data!.away} label={awayTeam} />
        ) : (
          <div className="text-caption1 text-fg-secondary">정보 없음</div>
        )}
      </div>
      <p className="mt-3 text-caption2 text-fg-secondary">출처: 네이버 스포츠 · 발표 후 표시</p>
    </section>
  );
}
