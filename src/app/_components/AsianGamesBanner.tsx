import Image from "next/image";
import Link from "next/link";
import { agPhase, daysToOpen } from "@/lib/asian-games/data";

/**
 * 2026 아이치·나고야 아시안게임 배너. 월드컵 배너(2026-07-30 제거)와 같은 틀.
 * 좌측 D-day 배지 + 가운데 대회명, 우측 히어로 그래픽.
 *
 * 🔴 `today` 는 부모가 KST 로 넘긴다. 폐막 다음 날(`closed`)까지만 그리고 그 뒤엔
 * 스스로 사라진다 — 대회가 끝났는데 배너가 남아 있으면 홈 제일 좋은 자리를 버린다.
 * 히어로는 직접 생성한 추상 그래픽이다(`public/asian-games-hero.jpg`). 대회 공식 엠블럼·
 * 보도 사진을 쓰지 않는다.
 */
export function AsianGamesBanner({ today, href = "/asian-games" }: { today: string; href?: string }) {
  const phase = agPhase(today);
  if (phase === "over") return null;
  const dday = daysToOpen(today);

  const badge =
    phase === "live" ? (
      <div className="shrink-0 rounded-lg bg-rose-500 px-3 py-1.5 text-center text-white shadow-lg">
        <div className="text-[9px] font-bold leading-none tracking-wider sm:text-[10px]">개최 중</div>
        <div className="mt-0.5 text-sm font-extrabold leading-none sm:text-lg">메달 순위</div>
      </div>
    ) : phase === "closed" ? (
      <div className="shrink-0 rounded-lg bg-zinc-200 px-3 py-1.5 text-center text-zinc-900 shadow-lg">
        <div className="text-sm font-extrabold leading-none sm:text-base">최종 순위</div>
      </div>
    ) : (
      <div className="shrink-0 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 py-1.5 text-center shadow-lg shadow-amber-900/30 ring-1 ring-amber-200/50 sm:px-3.5">
        <div className="text-[8px] font-bold leading-none tracking-wider text-amber-900 sm:text-[10px]">
          {phase === "prelim" ? "예선 진행 · 개막" : "개막까지"}
        </div>
        <div className="mt-0.5 text-lg font-extrabold leading-none text-amber-950 sm:text-2xl">D-{dday}</div>
      </div>
    );

  return (
    <Link href={href} aria-label="아이치·나고야 아시안게임 메달 순위와 한국 경기 일정 보기" className="group block">
      <div
        className="relative mb-6 h-[100px] overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-br from-[#08142b] via-[#10305c] to-[#08142b] ring-1 ring-inset ring-sky-300/10 transition-[filter] group-hover:brightness-110 sm:mb-8 sm:h-[128px]"
        style={{ position: "relative", overflow: "hidden" }}
      >
        <div className="absolute right-0 top-0 h-full w-[150px] sm:w-[228px]">
          <Image
            src="/asian-games-hero.jpg"
            alt=""
            aria-hidden
            fill
            sizes="228px"
            className="object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#08142b] via-[#08142b]/85 to-transparent" />

        <div className="relative flex h-full items-center px-4 sm:px-6">
          {badge}
          <div className="min-w-0 flex-1 px-1 text-center">
            <p className="whitespace-nowrap text-[9px] font-bold tracking-[0.16em] text-amber-300 drop-shadow sm:text-[11px]">
              AICHI-NAGOYA 2026
            </p>
            <h2 className="mt-0.5 text-base font-extrabold tracking-tight text-white drop-shadow sm:text-2xl">아시안게임</h2>
            <p className="mt-1 whitespace-nowrap text-[9px] font-medium text-sky-200/80 sm:text-[10px]">
              메달 순위 · 한국 경기 일정 ›
            </p>
          </div>
          <div className="w-[150px] shrink-0 sm:w-[228px]" aria-hidden />
        </div>
      </div>
    </Link>
  );
}
