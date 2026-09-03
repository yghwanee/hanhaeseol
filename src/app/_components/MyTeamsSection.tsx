"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Schedule } from "@/types/schedule";
import { keyTeamName, teamKey } from "@/lib/follows";
import { matchToSlug } from "@/lib/match-slug";
import { isGameFinished, formatDateHeader } from "@/lib/schedule-utils";
import { StatusBadge } from "./StatusBadge";
import { FollowStar } from "./FollowStar";
import { PushSubscribeButton } from "./PushSubscribeButton";

/** KST 벽시계 "YYYY-MM-DDTHH:mm". 날짜·시각 비교를 문자열 하나로 끝낸다. */
function kstNowKey(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16);
}

type Row = {
  key: string;
  teamName: string;
  sport: string;
  /** 앞으로 열릴 가장 이른 경기. 7일 편성에 없으면 null. */
  game: Schedule | null;
  platforms: string[];
};

/**
 * ⭐내 팀 — 찜한 팀의 **다음 경기**를 날짜 탭과 무관하게 보여준다.
 *
 * 이 섹션이 찜 기능의 존재 이유다. "내 팀 다음 경기가 언제 어디서"는 사람들이 한해설에
 * 오는 이유 그 자체인데, 지금은 날짜 탭을 하나씩 넘기거나 검색해야 나온다.
 */
export function MyTeamsSection({
  schedules,
  followKeys,
  onToggleTeam,
}: {
  /** 7일치 전체 편성(날짜 필터 적용 전). */
  schedules: Schedule[];
  followKeys: string[];
  onToggleTeam: (sport: Schedule["sport"], teamName: string) => void;
}) {
  const rows = useMemo<Row[]>(() => {
    if (followKeys.length === 0) return [];
    const now = kstNowKey();

    // 같은 경기가 채널마다 한 행씩 들어온다. 경기 단위로 접고 채널은 모아 적는다
    // (FilteredScheduleView 와 같은 키 — 시각은 사전방송 때문에 갈리므로 넣지 않는다).
    const byGame = new Map<string, { s: Schedule; platforms: string[] }>();
    for (const s of schedules) {
      const gk = `${s.date}|${s.homeTeam}|${s.awayTeam}`;
      const prev = byGame.get(gk);
      if (prev) {
        if (!prev.platforms.includes(s.platform)) prev.platforms.push(s.platform);
        // 한 채널이라도 한국어 해설이면 그 행을 대표로 — 뱃지가 실제 시청 조건을 보여야 한다.
        if (s.koreanCommentary === true && prev.s.koreanCommentary !== true) prev.s = s;
        continue;
      }
      byGame.set(gk, { s, platforms: [s.platform] });
    }

    const upcoming = [...byGame.values()]
      .filter((g) => `${g.s.date}T${g.s.time}` >= now)
      .sort((a, b) =>
        a.s.date === b.s.date
          ? a.s.time.localeCompare(b.s.time)
          : a.s.date.localeCompare(b.s.date),
      );

    return followKeys.map((key) => {
      const teamName = keyTeamName(key) ?? key;
      const sport = key.slice(0, key.indexOf("|"));
      const hit = upcoming.find(
        (g) =>
          teamKey(g.s.sport, g.s.homeTeam) === key ||
          (!!g.s.awayTeam && teamKey(g.s.sport, g.s.awayTeam) === key),
      );
      return {
        key,
        teamName,
        sport,
        game: hit?.s ?? null,
        platforms: hit?.platforms ?? [],
      };
    });
  }, [schedules, followKeys]);

  // 가장 가까운 경기 하나만 카운트다운한다. 여러 개 세면 시선이 흩어진다.
  const soonest = useMemo(() => {
    const games = rows.map((r) => r.game).filter((g): g is Schedule => !!g);
    if (games.length === 0) return null;
    return games.reduce((a, b) =>
      `${a.date}T${a.time}` <= `${b.date}T${b.time}` ? a : b,
    );
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <section className="mb-5 sm:mb-6 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3 sm:p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-amber-300/90">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.88l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.6z" />
          </svg>
          내 팀 다음 경기
        </h2>
        {soonest && <Countdown target={soonest} />}
      </div>

      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.key}
            className="relative flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-2"
          >
            <FollowStar
              followed
              onToggle={() => onToggleTeam(r.sport as Schedule["sport"], r.teamName)}
              label={r.teamName}
            />

            {r.game ? (
              <>
                <Link
                  href={`/match/${matchToSlug(r.game)}`}
                  className="absolute inset-0 z-0 rounded-lg"
                  aria-label={`${r.teamName} 다음 경기 상세 보기`}
                />
                <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 items-baseline gap-1.5 text-[13px] sm:text-sm">
                    <span className="shrink-0 font-semibold text-zinc-100">{r.teamName}</span>
                    <span className="truncate text-zinc-400">
                      vs {opponentOf(r.game, r.teamName)}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500">
                    <span className="shrink-0 font-mono text-zinc-300">
                      {formatDateHeader(r.game.date)} {r.game.time}
                    </span>
                    <span className="text-zinc-700">|</span>
                    <span className="truncate">{r.platforms.join(", ")}</span>
                  </div>
                </div>
                <div className="pointer-events-none relative z-10 shrink-0">
                  <StatusBadge
                    status={r.game.koreanCommentary}
                    finished={isGameFinished(r.game.date, r.game.time, r.game.sport)}
                  />
                </div>
              </>
            ) : (
              <div className="flex min-w-0 flex-1 items-baseline gap-2 text-[13px] sm:text-sm">
                <span className="shrink-0 font-semibold text-zinc-100">{r.teamName}</span>
                <span className="truncate text-[11px] text-zinc-500">
                  이번 주 편성 없음
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* 🔴 알림 구독 버튼은 원래 푸터에만 있었다. 찜을 막 한 사람이 그걸 찾아 내려갈 리
          없어서, 팀을 고른 **바로 그 자리**에 둔다. 미지원 환경(VAPID 미설정, 아이폰
          미설치, 인앱 웹뷰)에서는 컴포넌트가 스스로 숨는다. */}
      <div className="mt-2.5 flex justify-end text-[11px] text-zinc-400">
        <PushSubscribeButton />
      </div>
    </section>
  );
}

/** 찜한 팀이 홈이면 원정을, 원정이면 홈을 돌려준다. */
function opponentOf(g: Schedule, teamName: string): string {
  return g.homeTeam === teamName ? g.awayTeam : g.homeTeam;
}

/**
 * 가장 가까운 경기까지 남은 시간.
 *
 * 🔴 첫 렌더에서는 아무것도 안 그린다. 서버 HTML 과 클라이언트가 다른 시각을 계산해
 * 하이드레이션이 어긋나기 때문이다. 마운트 뒤 effect 에서만 값을 채운다.
 */
function Countdown({ target }: { target: Schedule }) {
  const at = useMemo(
    () => Date.parse(`${target.date}T${target.time}:00+09:00`),
    [target.date, target.time],
  );
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(at - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [at]);

  if (left === null || left <= 0) return null;

  const total = Math.floor(left / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, "0");

  return (
    <span
      className="shrink-0 font-mono text-[11px] sm:text-xs tabular-nums text-amber-200/80"
      aria-label="다음 경기까지 남은 시간"
    >
      {d > 0 ? `${d}일 ` : ""}
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
