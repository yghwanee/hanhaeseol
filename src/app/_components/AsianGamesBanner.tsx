"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AG_OPEN,
  AG_RAW_URL,
  agPhase,
  daysToOpen,
  medalsStarted,
  rankMedals,
  type AsianGamesData,
} from "@/lib/asian-games/data";
import { MedalIcon, TorchIcon } from "./AsianGamesIcons";

/**
 * 2026 아이치·나고야 아시안게임 홈 배너 (2026-09-15 전면 교체).
 *
 * 🔴 **개막 전과 개최 중이 다른 모양이다(화니 결정).**
 *  - 개막 전(before·prelim) = 시안 B 틀 + 시안 A 문구. 다크 카드·헤어라인·3D 성화, 오른쪽 D-day.
 *  - 개막 당일부터(live·closed) = 시안 C. 3D 금·은·동 메달과 대한민국 메달 수·종합 순위.
 * 종전 배너(남색 그라데이션·흰 D-day 칩·가운데 3줄·히어로 사진)는 "촌스럽다"로 내렸다.
 * 편성표 카드와 같은 면(`w-card`)·헤어라인이라 홈 안에서 튀지 않고, 3D 아이콘이
 * 후원 띠("승리 기원 응원하기")와 한 가족으로 읽힌다.
 *
 * 🔴 메달 수는 **브라우저가 GitHub raw 에서** 받는다(허브 페이지와 같은 경로). 홈은 배포
 * 시점에 구워지므로 서버 데이터로 그리면 하루 4번 배포 사이에 메달이 멈춘다. Vercel 을 안 타서
 * Hobby 한도(FOT·함수 호출)에도 안 걸린다. 받기 전에는 자리만 잡아 둔다(레이아웃 흔들림 방지).
 *
 * `today` 는 부모가 KST 로 넘긴다. 폐막 다음 날(`closed`)까지만 그리고 그 뒤엔 스스로 사라진다.
 */
// 누르면 허브의 오늘(없으면 다음 경기일) 일정 묶음으로 바로 떨어진다(`AsianGamesLive` 의 id="today").
export function AsianGamesBanner({ today, href = "/asian-games#today" }: { today: string; href?: string }) {
  const phase = agPhase(today);
  if (phase === "over") return null;
  if (phase === "live" || phase === "closed") {
    return <MedalBanner today={today} href={href} closed={phase === "closed"} />;
  }
  return <CountdownBanner today={today} href={href} />;
}

const [, OPEN_M, OPEN_D] = AG_OPEN.split("-").map(Number);
const OPEN_LABEL = `${OPEN_M}월 ${OPEN_D}일 개막`;

/** 개막 전 — 시안 B 틀 + 시안 A 문구. */
function CountdownBanner({ today, href }: { today: string; href: string }) {
  const dday = daysToOpen(today);
  return (
    <Link
      href={href}
      aria-label={`아시안게임 한국 경기 일정과 메달 순위 보기 · ${OPEN_LABEL} D-${dday}`}
      className="w-card mb-5 sm:mb-6 flex items-center gap-3 px-3.5 py-3.5 sm:gap-4 sm:px-5 sm:py-4"
    >
      <TorchIcon id="ag-torch" className="h-11 w-11 shrink-0 sm:h-14 sm:w-14" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-caption1 text-fg-secondary sm:text-label1">
          {OPEN_LABEL}
          <span className="hidden sm:inline"> · 아이치·나고야</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-body1 font-bold text-fg-strong sm:text-headline1">
          <span className="truncate">
            아시안게임 한국 경기 일정<span className="hidden sm:inline"> · 메달 순위</span>
          </span>
          <span aria-hidden className="shrink-0">›</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end sm:border-l sm:border-line-subtle sm:pl-5">
        <span className="hidden text-caption1 text-fg-tertiary sm:block">개막까지</span>
        <span className="text-body2 font-bold tabular-nums leading-none text-fg-strong sm:mt-1 sm:text-title3 sm:leading-none">
          D-{dday}
        </span>
      </span>
    </Link>
  );
}

type KoreaTally = { gold: number; silver: number; bronze: number; rank: number | null };

/** 개막 당일부터 — 시안 C. */
function MedalBanner({ today, href, closed }: { today: string; href: string; closed: boolean }) {
  const [tally, setTally] = useState<KoreaTally | null>(null);

  useEffect(() => {
    let alive = true;
    // 5분 단위로 캐시를 끊는다(허브 페이지와 같은 규칙). raw 는 매시 크롤 커밋을 따라간다.
    fetch(`${AG_RAW_URL}?t=${Math.floor(Date.now() / 300_000)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: AsianGamesData | null) => {
        if (!alive || !j?.medals?.length) return;
        const kor = rankMedals(j.medals).find((r) => r.countryId === "KOR");
        setTally({
          gold: kor?.gold ?? 0,
          silver: kor?.silver ?? 0,
          bronze: kor?.bronze ?? 0,
          // 🔴 첫 메달 전에는 순위를 안 쓴다. 전원 0개라 "공동 1위 45개국" 이 된다.
          rank: medalsStarted(j.medals) && kor ? kor.rank : null,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const day = 1 - daysToOpen(today);
  const status = closed ? "최종 결과" : `대회 ${day}일차`;
  const headline =
    tally?.rank != null
      ? `대한민국 ${closed ? "최종 " : "종합 "}${tally.rank}위`
      : tally
        ? "대한민국 첫 메달을 기다리는 중"
        : "대한민국 메달 집계";
  // 폰은 메달 세 개가 옆에 서서 자리가 좁다. "대한민국 첫 메달을 기다리는 중" 이 390px 에서
  // 잘렸다(2026-09-15 실측). 폰은 순위만, 순위가 없으면 나라 이름만 쓴다.
  const mobileHeadline = tally?.rank != null ? `대한민국 ${tally.rank}위` : "대한민국";
  const n = (v: number | undefined) => (tally ? String(v) : "–");

  return (
    <Link
      href={href}
      aria-label={`아시안게임 메달 순위와 한국 경기 일정 보기 · ${headline}`}
      className="w-card mb-5 sm:mb-6 flex flex-col gap-3 px-3.5 py-3.5 sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-4"
    >
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:flex-col sm:items-start sm:justify-center sm:gap-0.5">
        <span className="flex min-w-0 items-center gap-2 text-caption1 text-fg-secondary sm:text-label1">
          {closed ? (
            <span className="w-badge w-badge--outline shrink-0 text-caption2 font-bold">폐막</span>
          ) : (
            <span className="w-badge w-badge--danger shrink-0 text-caption2 font-bold">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-fg-danger" />
              개최 중
            </span>
          )}
          <span className="truncate">아시안게임 · {status}</span>
        </span>
        <span className="hidden items-center gap-1 text-headline1 font-bold text-fg-strong sm:flex">
          {headline} <span aria-hidden>›</span>
        </span>
        <span className="shrink-0 text-caption1 font-semibold text-fg-brand-bright sm:hidden">메달 순위 ›</span>
      </span>

      <span className="flex items-center justify-between gap-3 sm:justify-end sm:gap-5">
        <span className="truncate text-body1 font-bold text-fg-strong sm:hidden">{mobileHeadline}</span>
        <span className="flex shrink-0 items-center gap-3 sm:gap-5">
          {(
            [
              ["gold", "금", tally?.gold],
              ["silver", "은", tally?.silver],
              ["bronze", "동", tally?.bronze],
            ] as const
          ).map(([tone, label, v]) => (
            <span key={tone} className="flex items-center gap-1 sm:gap-2" aria-label={`${label} ${n(v)}`}>
              <MedalIcon id={`ag-${tone}`} tone={tone} className="h-7 w-7 sm:h-10 sm:w-10" />
              <span className="flex flex-col">
                <span className="hidden text-caption2 text-fg-tertiary sm:block">{label}</span>
                <span className="min-w-[1.5ch] text-body2 font-bold tabular-nums leading-tight text-fg-strong sm:text-heading1 sm:leading-tight">
                  {n(v)}
                </span>
              </span>
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}
