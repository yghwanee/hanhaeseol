"use client";

import { useEffect, useState } from "react";
import {
  AG_RAW_URL,
  groupByDate,
  medalsStarted,
  type AsianGamesData,
} from "@/lib/asian-games/data";

/**
 * 메달 순위표 + 한국 메달 + 한국 경기 일정.
 *
 * 서버가 배포 시점 데이터로 먼저 그리고(검색엔진이 보는 내용), 마운트 후 GitHub raw 에서
 * 최신본을 받아 갈아 끼운다. 배포는 하루 4번뿐이라 그대로 두면 메달이 최대 6시간 늦는다.
 * 🔴 raw 요청은 Vercel 을 거치지 않는다 — Hobby 의 FOT 한도를 안 쓴다.
 */

function fmtDate(date: string): string {
  const w = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${date}T12:00:00Z`).getUTCDay()];
  const [, m, dd] = date.split("-");
  return `${Number(m)}월 ${Number(dd)}일 (${w})`;
}

/** 한 번에 그리는 날짜 수. 경기가 몰리는 날은 하루 수십 건이라 HTML 이 불어난다(FOT). */
const DAYS_SHOWN = 3;

function kst(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function AsianGamesLive({ initial, today }: { initial: AsianGamesData; today: string }) {
  const [data, setData] = useState<AsianGamesData>(initial);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${AG_RAW_URL}?t=${Math.floor(Date.now() / 300_000)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: AsianGamesData | null) => {
        if (alive && j?.medals?.length && j.lastUpdated > initial.lastUpdated) setData(j);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [initial.lastUpdated]);

  const started = medalsStarted(data.medals);
  const rows = showAll ? data.medals : data.medals.slice(0, 10);
  const kor = data.korea;
  const upcoming = groupByDate(data.koreaGames.filter((g) => g.date >= today)).slice(0, DAYS_SHOWN);
  const recent = groupByDate(data.koreaGames.filter((g) => g.date < today)).slice(-1);

  return (
    <>
      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-white sm:text-lg">대한민국 메달</h2>
          <span className="text-[11px] text-zinc-500">{kst(data.lastUpdated)} 기준</span>
        </div>
        {kor ? (
          <>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                ["금", kor.gold, "text-amber-300"],
                ["은", kor.silver, "text-zinc-200"],
                ["동", kor.bronze, "text-orange-300"],
                ["합계", kor.total, "text-white"],
              ].map(([label, n, cls]) => (
                <div key={label as string} className="rounded-lg bg-zinc-950/60 py-2.5">
                  <div className={`text-2xl font-extrabold tabular-nums ${cls}`}>{n as number}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">{label as string}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-zinc-300">
              {started
                ? `종합 순위 ${kor.rank}위 (금메달 순).`
                : "아직 메달이 나오지 않았습니다. 첫 메달이 나오면 이 자리에 순위가 표시됩니다."}
            </p>
            {kor.disciplines.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {kor.disciplines.map((d) => (
                  <li key={d.name} className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">
                    {d.name} <span className="tabular-nums text-amber-300">금{d.gold}</span>{" "}
                    <span className="tabular-nums text-zinc-400">은{d.silver} 동{d.bronze}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">대한민국 메달 정보를 아직 받지 못했습니다.</p>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-white sm:text-lg">국가별 메달 순위</h2>
        {!started && (
          <p className="mt-2 text-sm text-zinc-400">
            첫 메달 전이라 모든 나라가 0개입니다. 메달이 나오면 금메달 수 기준으로 순위가 매겨집니다.
          </p>
        )}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="text-xs text-zinc-500">
                <th className="w-10 py-2 text-center font-medium">순위</th>
                <th className="py-2 text-left font-medium">국가</th>
                <th className="w-11 py-2 text-center font-bold text-amber-300">금</th>
                <th className="w-11 py-2 text-center font-medium text-zinc-300">은</th>
                <th className="w-11 py-2 text-center font-medium text-orange-300">동</th>
                <th className="w-12 py-2 text-center font-medium">합계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.countryId}
                  className={`border-t border-zinc-800/70 ${m.countryId === "KOR" ? "bg-sky-400/[0.08]" : ""}`}
                >
                  <td className="py-2 text-center tabular-nums text-zinc-400">{started ? m.rank : "-"}</td>
                  <td className={`py-2 ${m.countryId === "KOR" ? "font-bold text-white" : "text-zinc-200"}`}>{m.countryName}</td>
                  <td className="py-2 text-center tabular-nums font-semibold text-amber-300">{m.gold}</td>
                  <td className="py-2 text-center tabular-nums text-zinc-300">{m.silver}</td>
                  <td className="py-2 text-center tabular-nums text-orange-300">{m.bronze}</td>
                  <td className="py-2 text-center tabular-nums text-white">{m.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.medals.length > 10 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-3 min-h-[44px] w-full rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            {showAll ? "상위 10개국만 보기" : `전체 ${data.medals.length}개국 보기`}
          </button>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-white sm:text-lg">대한민국 경기 일정</h2>
        {upcoming.length === 0 && recent.length === 0 && (
          <p className="mt-2 text-sm text-zinc-400">앞으로 7일간 예정된 대한민국 경기가 없습니다.</p>
        )}
        {[...recent, ...upcoming].map(([date, games]) => (
          <div key={date} className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-300">
              {fmtDate(date)}
              {date < today && <span className="ml-1.5 text-xs font-normal text-zinc-500">지난 경기</span>}
            </h3>
            <ul className="space-y-1.5">
              {games.map((g) => (
                <li key={g.id} className="flex items-center gap-2 rounded-lg bg-zinc-950/50 px-3 py-2 text-sm">
                  <span className="w-11 shrink-0 tabular-nums text-zinc-400">{g.time}</span>
                  <span className="w-20 shrink-0 truncate text-zinc-300">{g.discipline}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-100">
                    {g.home && g.away ? (
                      <>
                        {g.home} {g.homeScore !== null ? <b className="tabular-nums">{g.homeScore}:{g.awayScore}</b> : "vs"} {g.away}
                        <span className="ml-1 text-xs text-zinc-500">{g.title}</span>
                      </>
                    ) : (
                      g.title
                    )}
                  </span>
                  {g.medal && <span className="shrink-0 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">메달</span>}
                  {g.status === "STARTED" && <span className="shrink-0 text-[10px] font-semibold text-rose-400">LIVE</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
