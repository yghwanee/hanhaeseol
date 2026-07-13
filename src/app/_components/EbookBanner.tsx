"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QUOTES from "@/data/ebook-quotes.json";

/**
 * fadeby 전자책 시집 프로모션 배너. 메인 상단(월드컵 배너 자리)에 노출.
 * 유화 배경 + 세리프 인용구 + 크림색 CTA. fadeby.vercel.app으로 새 탭 이동.
 * 인용구는 매일(KST 기준) 하나씩 순환 — 정본 book.json에서 3줄·44자 이내로 추린 98편.
 * 시 자체 줄바꿈(\n)을 whitespace-pre-line으로 그대로 살려 긴 글귀도 안 깨진다.
 * 디자인 출처: fadeby/generated/ebook/store/banner-haeseol.html (.fadeby-banner).
 */
const SERIF = "'Nanum Myeongjo','Batang',Georgia,'Times New Roman',serif";

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
      aria-label="fadeby 시집 『현재가 없는 사람들에게』 읽어 보기 (새 창)"
      className="group block"
    >
      <div className="relative mb-6 sm:mb-8 h-[136px] sm:h-[160px] overflow-hidden rounded-2xl bg-[#150f1b] transition-[filter] group-hover:brightness-110">
        {/* 유화 배경 (full-bleed) */}
        <Image
          src="/ebook-banner.jpg"
          alt=""
          aria-hidden
          fill
          sizes="(max-width: 640px) 100vw, 1040px"
          className="scale-[1.02] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          style={{ objectPosition: "center 32%" }}
        />
        {/* 좌측 어둠 베일 — 글자 가독성 */}
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(11,8,16,0.86)] to-[rgba(11,8,16,0.46)]" />

        <div className="relative flex h-full flex-col justify-center gap-1.5 px-5 sm:gap-2 sm:px-8">
          {/* 여는 따옴표 (장식) */}
          <span
            aria-hidden
            className="-mb-2 text-2xl leading-none text-[#a2432f] sm:-mb-3 sm:text-3xl"
            style={{ fontFamily: SERIF }}
          >
            &ldquo;
          </span>
          {/* 인용구 — 매일 순환. 시 자체 줄바꿈 유지. */}
          <blockquote
            className="m-0 max-w-[26ch] whitespace-pre-line text-[15px] font-medium leading-snug text-[#f1eadc] sm:text-xl"
            style={{ fontFamily: SERIF }}
          >
            {quote}
          </blockquote>
          {/* 출처 + CTA */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-[10px] tracking-wide text-[#a49cae] sm:text-xs">
              — 시집『현재가 없는 사람들에게』中 · fadeby
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#f1eadc] px-3.5 py-1.5 text-[12px] font-semibold text-[#231a16] transition-transform duration-150 group-hover:-translate-y-px sm:text-[13px]">
              시집 읽어 보기
              <span aria-hidden style={{ fontFamily: SERIF }}>
                →
              </span>
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
