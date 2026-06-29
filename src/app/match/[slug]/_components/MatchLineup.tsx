"use client";

import { useEffect, useState } from "react";

interface LineupPlayer {
  name: string;
  pos: string;
  number: number | null;
  goal: number;
  card: number;
}
interface TeamLineup {
  formation: string;
  lines: LineupPlayer[][];
}
interface LineupResponse {
  home: TeamLineup | null;
  away: TeamLineup | null;
}

function PlayerRow({ p, align }: { p: LineupPlayer; align: "left" | "right" }) {
  const badges = (
    <>
      {p.goal > 0 && <span aria-hidden>⚽{p.goal > 1 ? `×${p.goal}` : ""}</span>}
      {p.card === 1 && <span aria-hidden className="text-yellow-400">🟨</span>}
      {p.card >= 2 && <span aria-hidden className="text-rose-500">🟥</span>}
    </>
  );
  return (
    <div
      className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse text-right" : "text-left"}`}
    >
      <span className="inline-block min-w-[1.5rem] shrink-0 font-mono text-[10px] text-zinc-500">
        {p.number ?? "-"}
      </span>
      <span className="truncate text-zinc-200">{p.name}</span>
      {badges}
    </div>
  );
}

function TeamColumn({
  team,
  label,
  align,
}: {
  team: TeamLineup;
  label: string;
  align: "left" | "right";
}) {
  return (
    <div className="min-w-0">
      <div
        className={`mb-2 flex items-baseline gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <span className="truncate text-sm font-semibold text-white">{label}</span>
        {team.formation && (
          <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
            {team.formation}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {team.lines.map((line, i) => (
          <div key={i} className="space-y-0.5 text-[11px] sm:text-xs">
            {line.map((p, j) => (
              <PlayerRow key={j} p={p} align={align} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 경기 선발 라인업(포메이션+선발 XI). 네이버 /api/lineup을 클라에서 fetch.
 * 라인업이 아직 없으면(킥오프 한참 전 등) 아무것도 렌더하지 않는다(graceful).
 * 축구 경기에서만 부모가 렌더한다.
 */
export function MatchLineup({
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
    fetch(`/api/lineup?gameId=${encodeURIComponent(gameId)}`)
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

  // 라인업이 아직 없으면 섹션 자체를 숨김(빈 박스 노출 방지).
  if (loading || !data || (!data.home && !data.away)) return null;

  return (
    <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-white sm:text-base">선발 라인업</h2>
      <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8">
        {data.home ? (
          <TeamColumn team={data.home} label={homeTeam} align="left" />
        ) : (
          <div className="text-xs text-zinc-600">정보 없음</div>
        )}
        {data.away ? (
          <TeamColumn team={data.away} label={awayTeam} align="right" />
        ) : (
          <div className="text-xs text-zinc-600">정보 없음</div>
        )}
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">출처: 네이버 스포츠 · 교체 시 갱신</p>
    </section>
  );
}
