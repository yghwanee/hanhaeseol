import Image from "next/image";
import Link from "next/link";
import { agPhase, daysToOpen } from "@/lib/asian-games/data";

/**
 * 2026 아이치·나고야 아시안게임 배너. 월드컵 배너(2026-07-30 제거)와 같은 틀.
 * 좌측 D-day 배지 + 가운데 대회명, 우측 히어로 그래픽.
 *
 * 높이 72/92px — 처음엔 100/128px 이었는데 홈 첫 화면을 너무 먹었다(2026-09-14).
 * 줄일 때는 배지·제목·히어로 폭을 같이 줄여야 한다. 컨테이너만 낮추면 3줄 텍스트가
 * 서로 붙어 뭉개진다.
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
      <div className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-center text-[#08142b]">
        <div className="text-caption2 font-bold leading-none tracking-wider sm:text-caption2">개최 중</div>
        <div className="mt-0.5 text-[13px] font-extrabold leading-none sm:text-body1">메달 순위</div>
      </div>
    ) : phase === "closed" ? (
      <div className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-center text-[#08142b]">
        <div className="text-[13px] font-extrabold leading-none sm:text-label1">최종 순위</div>
      </div>
    ) : (
      <div className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-center sm:px-3">
        <div className="text-caption2 font-bold leading-none tracking-wider text-[#08142b]/70 sm:text-caption2">
          {phase === "prelim" ? "예선 진행 · 개막" : "개막까지"}
        </div>
        <div className="mt-0.5 text-body1 font-extrabold leading-none text-[#08142b] sm:text-heading2">D-{dday}</div>
      </div>
    );

  return (
    <Link href={href} aria-label="아이치·나고야 아시안게임 메달 순위와 한국 경기 일정 보기" className="group block">
      <div
        className="relative mb-5 h-[72px] overflow-hidden rounded-xl border border-brand/40 bg-gradient-to-br from-[#08142b] via-[#10305c] to-[#08142b] ring-1 ring-inset ring-brand/40 transition-[filter] group-hover:brightness-110 sm:mb-6 sm:h-[92px]"
        style={{ position: "relative", overflow: "hidden" }}
      >
        <div className="absolute right-0 top-0 h-full w-[104px] sm:w-[180px]">
          <Image
            src="/asian-games-hero.jpg"
            alt=""
            aria-hidden
            fill
            sizes="180px"
            className="object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#08142b] via-[#08142b]/85 to-transparent" />

        <div className="relative flex h-full items-center px-3 sm:px-5">
          {badge}
          <div className="min-w-0 flex-1 px-1 text-center">
            <p className="hidden whitespace-nowrap text-caption2 font-bold tracking-[0.14em] text-fg-strong/70 drop-shadow sm:block">
              AICHI-NAGOYA 2026
            </p>
            <h2 className="text-label1 font-extrabold leading-tight tracking-tight text-fg-strong drop-shadow sm:text-heading2">아시안게임</h2>
            <p className="text-caption2 font-medium leading-tight text-fg-brand-bright">
              메달 순위 · 한국 경기 일정 ›
            </p>
          </div>
          <div className="w-[104px] shrink-0 sm:w-[180px]" aria-hidden />
        </div>
      </div>
    </Link>
  );
}
