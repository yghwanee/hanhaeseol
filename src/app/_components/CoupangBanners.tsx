"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { INTRO_DONE_EVENT, isIntroDone } from "./IntroAnimation";
import { CoupangProductCard } from "./CoupangProductCard";
import { useShuffledProducts } from "./coupang-product-utils";

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
 *  PC 좌/우 사이드 (XL≥1280px) - 120x240 카드 2개 세로 스택
 * ──────────────────────────────────────────────────────────────────────── */
export function CoupangSideBanners() {
  const showAds = useShowAds();
  const pathname = usePathname();
  // 좌/우 다른 카드 보이도록 4개 뽑고 0-1=좌, 2-3=우 로 분배.
  const picks = useShuffledProducts(4, { dedupeCategory: true, refreshKey: "side" });
  if (!showAds || picks.length < 4 || isHiddenPath(pathname)) return null;

  const leftCards = picks.slice(0, 2);
  const rightCards = picks.slice(2, 4);

  return (
    <>
      <aside
        className="hidden xl:flex fixed left-4 top-1/2 -translate-y-1/2 z-10 flex-col gap-3"
        aria-label="쿠팡 파트너스 광고 (좌측)"
      >
        {leftCards.map((p) => (
          <CoupangProductCard key={p.id} product={p} size="lg" />
        ))}
      </aside>
      <aside
        className="hidden xl:flex fixed right-4 top-1/2 -translate-y-1/2 z-10 flex-col gap-3"
        aria-label="쿠팡 파트너스 광고 (우측)"
      >
        {rightCards.map((p) => (
          <CoupangProductCard key={p.id} product={p} size="lg" />
        ))}
      </aside>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  가로 스크롤 캐러셀 (728x90 자리 대체)
 *  - 모바일: 작은 카드 가로 스와이프
 *  - PC: 카드 5~6개 가로 정렬
 *  - 1:2 비율(120x240) 유지하느라 자리 높이가 기존 90보다 큼 — 시각적
 *    클릭률을 위해 의도된 조정.
 * ──────────────────────────────────────────────────────────────────────── */
function ProductCarousel({ countDesktop = 6, countMobile = 5, sizeDesktop = "sm", sizeMobile = "sm" }: {
  countDesktop?: number;
  countMobile?: number;
  sizeDesktop?: "xs" | "sm" | "md" | "lg";
  sizeMobile?: "xs" | "sm" | "md" | "lg";
}) {
  const picks = useShuffledProducts(Math.max(countDesktop, countMobile), {
    dedupeCategory: true,
    refreshKey: "carousel",
  });
  return (
    <>
      {/* 모바일 */}
      <div className="sm:hidden -mx-3 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2.5 pb-1">
          {picks.slice(0, countMobile).map((p) => (
            <CoupangProductCard key={p.id} product={p} size={sizeMobile} />
          ))}
        </div>
      </div>
      {/* PC */}
      <div className="hidden sm:block">
        <div className="flex justify-center gap-3">
          {picks.slice(0, countDesktop).map((p) => (
            <CoupangProductCard key={p.id} product={p} size={sizeDesktop} />
          ))}
        </div>
      </div>
    </>
  );
}

/** 매치 페이지 / about / faq / privacy / terms 상단 */
export function CoupangTopBanner() {
  const showAds = useShowAds();
  if (!showAds) return null;
  return (
    <div className="mb-6">
      <ProductCarousel countDesktop={6} countMobile={5} sizeDesktop="md" sizeMobile="sm" />
    </div>
  );
}

/** 메인 페이지 상단 / 그 외 페이지 상단 */
export function CoupangTopBannerOnly() {
  const showAds = useShowAds();
  if (!showAds) return null;
  return (
    <div className="mb-6">
      <ProductCarousel countDesktop={6} countMobile={5} sizeDesktop="md" sizeMobile="sm" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  메인 페이지 인라인 광고 (필터·날짜탭 아래, 경기 카드 사이)
 *  - ScheduleClient.tsx 의 인라인 iframe(320x100 / 680x140) 자리 대체
 *  - 모바일: 가로 스크롤
 *  - PC: 카드 6~7개 가로 정렬
 * ──────────────────────────────────────────────────────────────────────── */
export function CoupangInlineBanner() {
  const showAds = useShowAds();
  if (!showAds) return null;
  return (
    <div className="my-4 sm:my-6">
      <ProductCarousel countDesktop={7} countMobile={5} sizeDesktop="md" sizeMobile="sm" />
    </div>
  );
}
