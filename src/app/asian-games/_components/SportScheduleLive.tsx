"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  agSportsRawUrl,
  gamesForRender,
  genderOf,
  broadcastKey,
  fmtAgDate,
  groupByDate,
  groupEsports,
  groupStandingsTable,
  isKoreaGame,
  type AgGame,
  type AgSportsData,
} from "@/lib/asian-games/data";

/**
 * 아시안게임 종목별 페이지의 경기 목록(`/asian-games/[sport]`).
 *
 * 허브(`AsianGamesLive`)와 같은 방식이다 — 서버가 배포 시점 데이터로 먼저 그리고(검색엔진이
 * 보는 내용), 마운트 후 GitHub raw 에서 최신본을 받아 갈아 끼운다. raw 는 Vercel 을 안 거친다.
 *
 * 🔴 지난 경기를 접어 두되 **HTML 에서 빼지 않는다**(`hidden` 이 아니라 조건 렌더지만 서버
 * 첫 렌더는 전부 연 상태로 내보낸다). 「아시안게임 축구 결과」 검색도 이 페이지가 받는다.
 */

function Row({ g, tv }: { g: AgGame; tv?: string[] }) {
  const korea = isKoreaGame(g);
  const versus = g.home && g.away;
  return (
    <li className={`rounded-lg px-3 py-2 text-label1 ${korea ? "bg-brand-subtle" : "bg-subtle"}`}>
      <div className="flex items-center gap-2">
        <span className="w-11 shrink-0 tabular-nums text-fg-secondary">{g.time}</span>
        <span className="min-w-0 flex-1 truncate text-fg-strong">
          {versus ? (
            <>
              <span className={g.home === "대한민국" ? "font-bold" : ""}>{g.home}</span>{" "}
              {g.homeScore !== null ? <b className="tabular-nums">{g.homeScore}:{g.awayScore}</b> : "vs"}{" "}
              <span className={g.away === "대한민국" ? "font-bold" : ""}>{g.away}</span>
            </>
          ) : (
            g.title
          )}
        </span>
        {g.medal && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-caption2 font-semibold text-fg-secondary">메달</span>
        )}
        {g.status === "STARTED" && <span className="shrink-0 text-caption2 font-semibold text-fg-danger">LIVE</span>}
        {g.status === "RESULT" && !versus && <span className="shrink-0 text-caption2 text-fg-tertiary">종료</span>}
      </div>
      {g.players && g.players.length > 0 && (
        // 한국 선수 이름. 단체 종목은 수십 명이라 앞 여덟만 보이고 나머지는 수로 접는다.
        <p className="mt-1 pl-[3.25rem] text-caption1 leading-relaxed text-fg-secondary break-keep">
          한국 {g.players.slice(0, 8).join(" · ")}
          {g.players.length > 8 && ` 외 ${g.players.length - 8}명`}
        </p>
      )}
      {(versus || tv) && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-[3.25rem] text-caption2">
          {versus && <span className="text-fg-tertiary">{g.title}</span>}
          {tv?.map((t) => (
            <span
              key={t}
              className={`rounded-full px-2 py-0.5 font-semibold ${
                t.endsWith("한국어해설") ? "bg-brand-subtle text-fg-brand-bright" : "bg-muted text-fg"
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function DateList({
  games,
  today,
  broadcasts,
  anchor,
}: {
  games: AgGame[];
  today: string;
  broadcasts: Record<string, string[]>;
  anchor?: string;
}) {
  const [showPast, setShowPast] = useState(true);
  // 서버 렌더는 지난 경기까지 전부 담고(검색엔진·결과 검색), 마운트 후에만 접는다.
  useEffect(() => setShowPast(false), []);
  const upcoming = groupByDate(games.filter((g) => g.date >= today));
  const past = groupByDate(games.filter((g) => g.date < today));
  const pastCount = past.reduce((n, [, gs]) => n + gs.length, 0);
  const shown = showPast ? [...past, ...upcoming] : upcoming;
  return (
    <>
      {upcoming.length === 0 && past.length > 0 && (
        <p className="mt-2 text-label1 text-fg-secondary">남은 경기가 없습니다. 지난 경기 결과를 펼쳐 보세요.</p>
      )}
      {past.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className="mt-3 min-h-[44px] w-full rounded-lg border border-line text-label1 text-fg hover:bg-muted"
        >
          {showPast ? "지난 경기 접기" : `지난 경기 결과 ${pastCount}건 보기`}
        </button>
      )}
      {shown.map(([date, gs]) => {
        const isToday = date === today;
        return (
          <div
            key={date}
            id={anchor && date === upcoming[0]?.[0] ? anchor : undefined}
            className={`mt-4 scroll-mt-20 ${isToday ? "rounded-xl border border-line-strong p-3 sm:p-4" : ""}`}
          >
            <h3 className="mb-2 flex items-center gap-2 text-label1 font-semibold text-fg">
              {fmtAgDate(date)}
              {isToday && (
                <span className="text-caption2 font-bold leading-none tracking-wider text-fg-danger">TODAY</span>
              )}
              {date < today && <span className="text-caption1 font-normal text-fg-tertiary">지난 경기</span>}
            </h3>
            <ul className="space-y-1.5">
              {gs.map((g) => (
                <Row
                  key={g.id}
                  g={g}
                  tv={g.home && g.away ? broadcasts[broadcastKey(g.date, g.home, g.away)] : undefined}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

function kst(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function SportScheduleLive({
  slug,
  name,
  initialGames,
  lastUpdated,
  today,
  broadcasts,
  onlyEvent,
}: {
  slug: string;
  name: string;
  initialGames: AgGame[];
  lastUpdated: string;
  today: string;
  broadcasts: Record<string, string[]>;
  /** 한 세부 종목만 보여 줄 때(롤 전용 페이지 = `ESPOLOL`). 갱신본에도 같은 거름을 건다. */
  onlyEvent?: string;
}) {
  const [games, setGames] = useState(initialGames);
  const [updated, setUpdated] = useState(lastUpdated);

  useEffect(() => {
    let alive = true;
    fetch(`${agSportsRawUrl(slug)}?t=${Math.floor(Date.now() / 300_000)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: AgSportsData | null) => {
        const fresh = onlyEvent ? j?.games?.filter((g) => g.event === onlyEvent) : j?.games;
        if (alive && fresh?.length && j!.lastUpdated > lastUpdated) {
          setGames(gamesForRender(fresh, today));
          setUpdated(j!.lastUpdated);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug, lastUpdated, today, onlyEvent]);

  const stamp = <span className="shrink-0 text-caption2 text-fg-tertiary">{kst(updated)} 기준</span>;

  if (slug === "esports") {
    return (
      <>
        {groupEsports(games).map(({ name: title, games: gs }, i) => (
          <section
            key={title}
            id={i === 0 ? "lol" : undefined}
            className="mb-6 scroll-mt-20 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5"
          >
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
              <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">
                {title} 일정{" "}
                <span className="whitespace-nowrap text-label1 font-normal text-fg-tertiary">({gs.length}경기)</span>
              </h2>
              {i === 0 && stamp}
            </div>
            {/* e스포츠 페이지의 롤 묶음 → 롤 전용 페이지(국가대표 명단). 롤 페이지 자신에서는 안 단다. */}
            {!onlyEvent && title.startsWith("리그 오브 레전드") && (
              <Link
                href="/asian-games/lol"
                className="relative mt-1 inline-block text-label1 text-fg underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong"
              >
                롤 국가대표 명단(페이커 등)과 일정 따로 보기
              </Link>
            )}
            <DateList games={gs} today={today} broadcasts={broadcasts} anchor={i === 0 ? "today" : undefined} />
          </section>
        ))}
      </>
    );
  }

  const korea = games.filter(isKoreaGame);
  const groups = groupStandingsTable(games);
  // 남자·여자가 둘 다 있으면 나눠 그린다(제목이 검색어와 같아진다).
  const genders = (["남자", "여자"] as const).filter((g) => games.some((x) => genderOf(x) === g));
  return (
    <>
      <section id="korea" className="mb-6 scroll-mt-20 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
          <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">
            대한민국 {name} 경기 일정·결과{" "}
            <span className="whitespace-nowrap text-label1 font-normal text-fg-tertiary">({korea.length}경기)</span>
          </h2>
          {stamp}
        </div>
        {korea.length === 0 ? (
          <p className="mt-2 text-label1 text-fg-secondary">
            대한민국 선수 경기가 아직 표시되지 않습니다. 개인 종목은 네이버 대회 데이터에 한국 선수가 붙는 시점이 늦습니다 — 확인되는 대로 이 자리에 채워집니다. 아래 전체 일정에서 라운드별 시간과 금메달 경기를 볼 수 있습니다.
          </p>
        ) : (
          <DateList games={korea} today={today} broadcasts={broadcasts} anchor="today" />
        )}
      </section>

      {groups.length > 0 && (
        <section id="groups" className="mb-6 scroll-mt-20 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
          <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">아시안게임 {name} 조편성</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((gr) => (
              <li key={gr.label} className="rounded-lg bg-subtle px-3 py-2 text-label1">
                <span className="font-semibold text-fg-strong">{gr.label}</span>{" "}
                <span className="text-fg">
                  {gr.teams.map((t, i) => (
                    <span key={t}>
                      {i > 0 && " · "}
                      <span className={t === "대한민국" ? "font-bold text-fg-strong" : ""}>{t}</span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 🔴 성별로 나눠 h2 를 단다 — `아시안게임 남자 축구` 17,390/월 · `여자 축구` 9,110/월
       *  (2026-09-21 검색광고 실측). 한 덩어리로 두면 그 어구가 화면에 아예 없다. */}
      {genders.length > 1 ? (
        genders.map((gd) => {
          const gs = games.filter((g) => genderOf(g) === gd);
          return (
            <section key={gd} id={gd === "남자" ? "men" : "women"} className="mb-6 scroll-mt-20 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
              <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">
                아시안게임 {gd} {name} 일정{" "}
                <span className="whitespace-nowrap text-label1 font-normal text-fg-tertiary">({gs.length}경기)</span>
              </h2>
              <DateList games={gs} today={today} broadcasts={broadcasts} />
            </section>
          );
        })
      ) : (
        <section className="mb-6 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
          <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">
            아시안게임 {name} 전체 경기 일정{" "}
            <span className="whitespace-nowrap text-label1 font-normal text-fg-tertiary">({games.length}경기)</span>
          </h2>
          <DateList games={games} today={today} broadcasts={broadcasts} />
        </section>
      )}
    </>
  );
}
