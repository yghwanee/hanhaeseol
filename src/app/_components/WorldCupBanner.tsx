import Image from "next/image";
import Link from "next/link";

/**
 * 2026 북중미 월드컵 컴팩트 배너. 좌측 D-day + 대회명(가운데), 우측 국가대표 히어로.
 * href로 이동(조별 순위/기록 페이지 등). 일정 뷰와 순위 페이지에서 공용.
 */
export function WorldCupBanner({ dday, href }: { dday: number | null; href: string }) {
  return (
    <Link href={href} aria-label="북중미 월드컵 조별 순위·기록 보기" className="group block">
      <div className="relative mb-6 sm:mb-8 h-[100px] sm:h-[128px] overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-[#0a0f3d] via-[#141c63] to-[#0a0f3d] ring-1 ring-inset ring-amber-300/10 transition-[filter] group-hover:brightness-110">
        {/* 우측 히어로 이미지 (16:9) */}
        <div className="absolute right-0 top-0 h-full w-[150px] sm:w-[228px]">
          <Image
            src="/worldcup-hero.jpg"
            alt="대한민국 축구 국가대표팀 — 한계를 넘어 하나된 Reds"
            fill
            priority
            sizes="228px"
            className="object-cover object-center"
          />
        </div>
        {/* 좌측 네이비 페이드 — 글자 가독성 */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f3d] via-[#0a0f3d]/85 to-transparent" />

        <div className="relative flex h-full items-center px-4 sm:px-6">
          {dday !== null && dday > 0 && (
            <div className="shrink-0 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 sm:px-3.5 py-1.5 text-center shadow-lg shadow-amber-900/30 ring-1 ring-amber-200/50">
              <div className="text-[8px] sm:text-[10px] font-bold leading-none tracking-wider text-amber-900">개막까지</div>
              <div className="mt-0.5 text-lg sm:text-2xl font-extrabold leading-none text-amber-950">D-{dday}</div>
            </div>
          )}
          {dday !== null && dday <= 0 && (
            <div className="shrink-0 rounded-lg bg-rose-500 px-3 py-1.5 text-center text-white shadow-lg">
              <div className="text-sm sm:text-base font-extrabold leading-none">조별 순위</div>
            </div>
          )}
          {/* 대회명 — 배지와 우측 이미지 사이 가운데 정렬 */}
          <div className="min-w-0 flex-1 px-1 text-center">
            <p className="whitespace-nowrap text-[9px] sm:text-[11px] font-bold tracking-[0.16em] text-amber-300 drop-shadow">FIFA WORLD CUP 2026</p>
            <h2 className="mt-0.5 text-base sm:text-2xl font-extrabold tracking-tight text-white drop-shadow">북중미 월드컵</h2>
            <p className="mt-1 whitespace-nowrap text-[9px] sm:text-[10px] font-medium text-amber-200/80">조별 순위·기록 ›</p>
          </div>
          {/* 우측 이미지 폭만큼 자리 확보 → 제목이 이미지와 안 겹치고 가운데로 */}
          <div className="w-[150px] sm:w-[228px] shrink-0" aria-hidden />
        </div>
      </div>
    </Link>
  );
}
