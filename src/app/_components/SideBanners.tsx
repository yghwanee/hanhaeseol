"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { INTRO_DONE_EVENT, isIntroDone } from "./IntroAnimation";
import { ChaeunSideBanner } from "./ChaeunSideBanner";
import { AdfitBanner } from "./AdfitBanner";

/** /admin/* 같은 운영자 페이지에서는 광고 자체를 숨김.
 *  audit 데모 영상에 광고가 끼면 reviewer 가 혼란스러워질 수 있어서. */
function isHiddenPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/admin");
}

/** 인트로(fixed z-[100] bg-zinc-950) 가 끝난 뒤 광고 노출.
 *  - 메인 페이지: IntroAnimation 마운트되니 INTRO_DONE_EVENT 받아 즉시 표시.
 *  - 매치/about/faq 등 인트로 없는 페이지: 이벤트가 절대 안 오므로 500ms
 *    fallback timer 로 표시. (이 페이지엔 인트로 깜빡임 자체가 없으니 안전.) */
function useShowAds() {
  const [showAds, setShowAds] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isIntroDone()) {
      setShowAds(true);
      return;
    }
    const reveal = () => setShowAds(true);
    window.addEventListener(INTRO_DONE_EVENT, reveal);
    const fallback = window.setTimeout(reveal, 500);
    return () => {
      window.removeEventListener(INTRO_DONE_EVENT, reveal);
      window.clearTimeout(fallback);
    };
  }, []);
  return showAds;
}

/* ─────────────────────────────────────────────────────────────────────────
 *  PC 좌/우 사이드 (XL≥1280px) - 좌측 채운 프로모 + 우측 애드핏 160x600
 * ──────────────────────────────────────────────────────────────────────── */
export function SideBanners() {
  const showAds = useShowAds();
  const pathname = usePathname();
  if (!showAds || isHiddenPath(pathname)) return null;

  return (
    <>
      <aside
        className="hidden xl:flex fixed left-4 top-1/2 -translate-y-1/2 z-10 flex-col gap-3"
        aria-label="채운 프로모션 (좌측)"
      >
        <ChaeunSideBanner />
      </aside>
      <aside
        className="hidden xl:flex fixed right-4 top-1/2 -translate-y-1/2 z-10 flex-col gap-3"
        aria-label="애드핏 광고 (우측)"
      >
        <AdfitBanner slot="sideRight" />
      </aside>
    </>
  );
}

/* 2026-07-30: 캐러셀 계열(CoupangTopBanner / CoupangTopBannerOnly / CoupangInlineBanner)과
 * 그 공용 ProductCarousel 을 전부 제거했다. 상단(고지 문구 아래·날짜 탭 위)과 홈 인라인
 * (오후 경기 구분선 아래) 자리는 카카오 애드핏 배너가 쓴다 — `AdfitBanner`.
 * 2026-07-30(추가): 우측 사이드 쿠팡 카드도 애드핏(160x600, slot="sideRight")으로
 * 교체하며 파일명도 CoupangBanners.tsx → SideBanners.tsx, 컴포넌트도
 * CoupangSideBanners → SideBanners 로 바꿨다(더 이상 쿠팡이 안 남아 이름이 거짓말이
 * 됐었다). 쿠팡 파트너스는 이제 사이트에서 완전히 빠짐(coupang-products.json·
 * CoupangProductCard·fetch-coupang-meta 스크립트는 재개 대비로 데이터만 남겨뒀다). */
