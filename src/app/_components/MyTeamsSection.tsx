"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Schedule } from "@/types/schedule";
import { keyTeamName, opponentOf, teamKey } from "@/lib/follows";
import { matchToSlug } from "@/lib/match-slug";
import { isGameFinished, formatDateHeader } from "@/lib/schedule-utils";
import { StatusBadge } from "./StatusBadge";
import { FollowStar } from "./FollowStar";
import { PushSubscribeButton } from "./PushSubscribeButton";
import { currentSubscription, PUSH_SUB_EVENT } from "@/lib/push/client";

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
  // 🔴 기준 시각을 분마다 갱신한다. useMemo 안에서 한 번 읽고 말면 마운트 시점에
  // 얼어붙어, 홈을 열어 둔 채로 경기가 끝나도 "다음 경기"가 안 넘어간다(카운트다운은
  // 0 에서 사라지므로 시간 단서마저 없어진다).
  const [minuteTick, setMinuteTick] = useState(() => kstNowKey());
  useEffect(() => {
    const id = setInterval(() => setMinuteTick(kstNowKey()), 30_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (followKeys.length === 0) return [];
    const now = minuteTick;

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
  }, [schedules, followKeys, minuteTick]);

  // 가장 가까운 경기 하나만 카운트다운한다. 여러 개 세면 시선이 흩어진다.
  const soonest = useMemo(() => {
    const games = rows.map((r) => r.game).filter((g): g is Schedule => !!g);
    if (games.length === 0) return null;
    return games.reduce((a, b) =>
      `${a.date}T${a.time}` <= `${b.date}T${b.time}` ? a : b,
    );
  }, [rows]);

  /**
   * 🔴 **찜이 0개여도 구독 중이면 이 자리를 비우지 않는다.**
   *
   * 알림 on/off 컨트롤은 이 섹션 하나뿐인데(푸터 토글은 2026-09-15 에 없앴다) 섹션이
   * 찜 개수로만 렌더되면, **알림을 켜 놓고 찜을 다 푼 사람은 끌 방법이 화면에서 사라진다.**
   * 작업111 에서 같은 고장을 한 번 고쳤다("켠 사람이 끌 방법이 없다"). 얇은 한 줄로 남긴다.
   */
  const [hasSub, setHasSub] = useState(false);
  useEffect(() => {
    const read = () => {
      void currentSubscription().then((sub) => setHasSub(Boolean(sub)));
    };
    read();
    window.addEventListener(PUSH_SUB_EVENT, read);
    return () => window.removeEventListener(PUSH_SUB_EVENT, read);
  }, []);

  if (rows.length === 0) {
    if (!hasSub) return null;
    return (
      <section className="w-invert-surface mb-5 sm:mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 sm:px-4">
        <p className="flex items-center gap-1.5 text-caption1 text-fg-secondary">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden>
            <path d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.88l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.6z" />
          </svg>
          팀 이름 옆 별을 누르면 그 팀 경기 알림이 옵니다
        </p>
        <PushSubscribeButton ctaOnly />
      </section>
    );
  }

  return (
    /* 🔴 **흰 판**이다(화니 지시, 2026-09-15: "이 섹션이 눈에 잘 안 띈다 — 날짜 선택된
       것처럼 흰 바탕으로"). 다크 카드가 스무 장 넘게 흐르는 화면에서 회색 판 하나로는
       구분이 안 됐다. 색 하나하나가 아니라 `.w-invert-surface` 가 토큰을 뒤집는다 —
       그래야 안쪽 뱃지·토글·안내 문구까지 같이 맞는다(globals.css 참조). PC·모바일 동일. */
    <section className="w-invert-surface mb-5 sm:mb-6 rounded-xl p-3 sm:p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-label1 font-semibold text-fg-secondary">
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
            /* 🔴 `bg-surface` 는 반전 스코프에서 판과 같은 흰색이라 행이 사라진다.
               한 단 낮은 회색(`bg-muted`)으로 깔아 목록이 판 안에서 읽히게 한다. */
            className="relative flex items-center gap-2 rounded-lg border border-line-subtle bg-muted px-2.5 py-2"
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
                  <div className="flex min-w-0 items-baseline gap-1.5 text-[13px] sm:text-label1">
                    <span className="shrink-0 font-semibold text-fg-strong">{r.teamName}</span>
                    <span className="truncate text-fg-secondary">
                      vs {opponentOf(r.game, r.teamName)}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 text-caption2 text-fg-tertiary">
                    {/* 🔴 `font-mono` 금지. 이 문자열엔 한글이 들어간다("9월 4일 (금) 18:15").
                        Tailwind 기본 mono 스택(Consolas·Menlo…)엔 **한글 글리프가 없어서**
                        숫자는 Consolas, 한글은 시스템 폰트로 한 문자열 안에서 갈렸다
                        (2026-09-03 사용자 지적). 자리 정렬만 필요하므로 본문 폰트 +
                        `tabular-nums` 로 충분하다. */}
                    <span className="shrink-0 tabular-nums text-fg">
                      {formatDateHeader(r.game.date)} {r.game.time}
                    </span>
                    <span className="text-fg-tertiary">·</span>
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
              <div className="flex min-w-0 flex-1 items-baseline gap-2 text-[13px] sm:text-label1">
                <span className="shrink-0 font-semibold text-fg-strong">{r.teamName}</span>
                <span className="truncate text-caption2 text-fg-tertiary">
                  이번 주 편성 없음
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* 🔴 알림 구독 버튼은 원래 푸터에만 있었다. 찜을 막 한 사람이 그걸 찾아 내려갈 리
          없어서, 팀을 고른 **바로 그 자리**에 둔다. 미지원 환경(VAPID 미설정, 아이폰
          미설치, 인앱 웹뷰)에서는 컴포넌트가 스스로 숨는다.
          켠 뒤에도 이 자리에 "알림 켜짐" 이 남는다 — 상태를 푸터에만 두면 아무도 못 본다. */}
      <div className="mt-2.5 flex justify-end text-caption2 text-fg-secondary">
        <PushSubscribeButton ctaOnly />
      </div>
    </section>
  );
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

  // 🔴 `font-mono` 를 쓰지 않는다. "2일 05:12:33" 처럼 **한글 한 글자가 섞이는데**
  // Tailwind 기본 mono 스택(Consolas·Menlo…)엔 한글 글리프가 없어 "일" 만 다른 폰트로
  // 튄다(2026-09-03). 초 단위로 흐르는 자리라 폭 흔들림을 막아야 하는데, 그건 mono 가
  // 아니라 `tabular-nums` 가 하는 일이다 — 이미 붙어 있었다.
  return (
    <span
      className="shrink-0 text-caption2 sm:text-caption1 tabular-nums text-fg-secondary"
      aria-label="다음 경기까지 남은 시간"
    >
      {d > 0 ? `${d}일 ` : ""}
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
