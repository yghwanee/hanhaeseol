"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QUOTES from "@/data/ebook-quotes.json";

/**
 * fadeby 전자책 프로모션 배너. 메인 상단(월드컵 배너 자리)에 노출.
 * 표지 유화를 배너 전체 full-bleed 배경(object-cover)으로 깔고 좌측에 어둠 베일 +
 * 볼드 인용구(Pretendard) 오버레이, CTA는 우측 세로 가운데 배치. fadeby.vercel.app 새 탭.
 * 인용구는 매일(KST 기준) 하나씩 순환 — book.json에서 3줄·각 줄 16자 이내로 추린 72편
 * (고정 높이 배너에서 가로 줄바꿈 없이 최대 3줄로 떨어지는 것만 남김).
 * 시 자체 줄바꿈(\n)을 whitespace-pre-line으로 살리고, line-clamp-3으로 혹시 넘쳐도 안 깨진다.
 */
// 인용구 폰트 = Pretendard(layout.tsx localFont, display:swap). 로드 전엔 시스템 산세리프 폴백.
const FONT = "var(--font-pretendard),-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif";

export function EbookBanner() {
  // SSR(빌드)·최초 클라 렌더는 0번 고정 → hydration mismatch 없음.
  // 마운트 후 KST 날짜 기반 인덱스로 교체(매일 자동으로 바뀜, 리빌드 불필요).
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const kstDay = Math.floor((Date.now() + 9 * 3600 * 1000) / 86400000);
    setIdx(kstDay % QUOTES.length);
  }, []);
  const quote = QUOTES[idx];

  return (
    <a
      href="https://fadeby.vercel.app"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="fadeby 『현재가 없는 사람들에게』 읽어 보기 (새 창)"
      className="group block"
      style={{ fontFamily: FONT }}
    >
      <div className="relative mb-6 h-[136px] overflow-hidden rounded-2xl bg-[#150f1b] transition-[filter] group-hover:brightness-[1.06] sm:mb-8 sm:h-[160px]">
        {/* 표지 유화 — 배너 전체 배경(full-bleed). */}
        <Image
          src="/ebook-banner.jpg"
          alt=""
          aria-hidden
          fill
          sizes="(max-width: 640px) 100vw, 1040px"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          style={{ objectPosition: "center 55%" }}
        />
        {/* 좌측 어둠 베일 — 글자 가독성 */}
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(11,8,16,0.92)] via-[rgba(11,8,16,0.72)] to-[rgba(11,8,16,0.4)]" />

        {/* 인용구 영역 (오버레이). 데스크톱은 오른쪽에 CTA 공간(pr 크게), 모바일은 CTA를 하단 인라인. */}
        <div className="relative flex h-full min-w-0 flex-col justify-center gap-2 pl-6 pr-6 sm:gap-2.5 sm:pl-10 sm:pr-48">
          {/* 여는 따옴표 (장식) — 글귀와 간격 좁힘 */}
          <span aria-hidden className="-mb-2.5 text-2xl leading-none text-[#a2432f] sm:-mb-3.5 sm:text-3xl">
            &ldquo;
          </span>
          {/* 인용구 — 매일 순환. 시 자체 줄바꿈 유지. */}
          <blockquote className="m-0 line-clamp-3 whitespace-pre-line text-[15px] font-bold leading-snug text-[#f1eadc] drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] sm:text-xl">
            {quote}
          </blockquote>
          {/* 출처 + 모바일 CTA */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] tracking-wide text-[#b3aab8] sm:text-xs">
              —『현재가 없는 사람들에게』· fadeby
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#f1eadc] px-3.5 py-1.5 text-[12px] font-semibold text-[#231a16] shadow-md sm:hidden">
              지금 읽어 보기
              <span aria-hidden>→</span>
            </span>
          </div>
        </div>

        {/* CTA — 데스크톱: 우측 하단 쪽 */}
        <span className="absolute bottom-6 right-8 hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-[#f1eadc] px-4 py-2 text-[13px] font-semibold text-[#231a16] shadow-md transition-transform duration-150 group-hover:scale-[1.04] sm:inline-flex">
          지금 읽어 보기
          <span aria-hidden>→</span>
        </span>
      </div>
    </a>
  );
}
