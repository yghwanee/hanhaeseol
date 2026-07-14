"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QUOTES from "@/data/ebook-quotes.json";

/**
 * fadeby 전자책 프로모션 배너. 메인 상단(월드컵 배너 자리)에 노출.
 * 좌측 인용구(Pretendard) + 우측에 표지 유화를 축소·가운데(object-contain)로 배치.
 * fadeby.vercel.app으로 새 탭 이동.
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
      <div className="relative mb-6 flex h-[136px] items-center gap-3 overflow-hidden rounded-2xl bg-[#150f1b] px-5 transition-[filter] group-hover:brightness-[1.06] sm:mb-8 sm:h-[160px] sm:gap-6 sm:px-8">
        {/* 인용구 영역 */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 sm:gap-2">
          {/* 여는 따옴표 (장식) */}
          <span aria-hidden className="-mb-2 text-2xl leading-none text-[#a2432f] sm:-mb-3 sm:text-3xl">
            &ldquo;
          </span>
          {/* 인용구 — 매일 순환. 시 자체 줄바꿈 유지. */}
          <blockquote className="m-0 line-clamp-3 whitespace-pre-line text-[15px] font-medium leading-snug text-[#f1eadc] sm:text-xl">
            {quote}
          </blockquote>
          {/* 출처 + CTA */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-[10px] tracking-wide text-[#a49cae] sm:text-xs">
              —『현재가 없는 사람들에게』· fadeby
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#f1eadc] px-3.5 py-1.5 text-[12px] font-semibold text-[#231a16] transition-transform duration-150 group-hover:-translate-y-px sm:text-[13px]">
              지금 읽어 보기
              <span aria-hidden>→</span>
            </span>
          </div>
        </div>

        {/* 표지 유화(세로 900×1351) — 축소·가운데. 박스를 표지 비율에 맞춰 여백 없이.
            모바일에선 인용구 폭 확보 위해 숨김. */}
        <div className="relative hidden aspect-[900/1351] h-[82%] shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-white/10 sm:block">
          <Image
            src="/ebook-banner.jpg"
            alt=""
            aria-hidden
            fill
            sizes="120px"
            className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        </div>
      </div>
    </a>
  );
}
