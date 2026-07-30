"use client";

import Image from "next/image";

/**
 * 채운(chaeun.haeseol.com) 자매 프로젝트 프로모 — 한해설 메인 좌측 사이드(XL≥1280px).
 *
 * 2026-07-30: 직접 조립하던 배너(인장 락업 + 연꽃 크롭 + 세로쓰기 태그라인 + CTA)를
 * 채운 쪽에서 만든 완성 시안 한 장으로 교체했다. 로고·카피·CTA가 이미 이미지 안에 있어
 * 코드에서 다시 그릴 이유가 없다(브랜드 요소는 창작 금지 — 원본을 그대로 쓴다).
 *
 * 원본은 `chaeun/refs/drafts/final-banner.png`(248x1000 = 표시 크기 124x500 의 2배,
 * 216KB). WebP q90 으로 23KB 까지 줄여 `public/chaeun-side-banner.webp` 로 넣었다.
 * **시안이 바뀌면 자동 동기화되지 않는다 — 원본에서 다시 변환해야 한다.**
 */
export function ChaeunSideBanner() {
  return (
    <a
      href="https://chaeun.haeseol.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="채운 — 내 사주에 비어 있는 기운 배경화면 한 장, 무료로 받기 (새 창)"
      title="채운 彩運 — 빛나는 운을 채우다"
      className="group block shrink-0"
      style={{ width: 124 }}
    >
      <Image
        src="/chaeun-side-banner.webp"
        alt="채운 — 내 사주에 비어 있는 기운, 배경화면 한 장 무료로 받기"
        width={124}
        height={500}
        sizes="124px"
        // 기본 q=75 는 이미 lossy 인 WebP 를 다시 인코딩해 글자(로고·카피·CTA)가 뭉갠다.
        quality={90}
        className="rounded-xl ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.02] group-hover:ring-white/25"
      />
    </a>
  );
}
