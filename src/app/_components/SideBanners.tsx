"use client";

import { usePathname } from "next/navigation";
import { ChaeunSideBanner } from "./ChaeunSideBanner";
import { AdfitBanner } from "./AdfitBanner";
import { useAdsReady } from "./ads-ready";

/** /admin/* 같은 운영자 페이지에서는 광고 자체를 숨김.
 *  audit 데모 영상에 광고가 끼면 reviewer 가 혼란스러워질 수 있어서. */
function isHiddenPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/admin");
}

/* ─────────────────────────────────────────────────────────────────────────
 *  PC 좌/우 사이드 (XL≥1280px) - 좌측 채운 프로모 + 우측 애드핏 160x600
 * ──────────────────────────────────────────────────────────────────────── */
export function SideBanners() {
  // 🔴 우측 애드핏 슬롯이 홈 상단 슬롯과 **같은 커밋에** 마운트돼야 한다.
  // 종전엔 이 컴포넌트만 인트로 종료를 기다려서, 먼저 뜬 상단 슬롯이 SDK 스캔을
  // 끝내버리고 우측 배너가 영구히 빈칸으로 남았다(ads-ready.ts 참고).
  const adsReady = useAdsReady();
  const pathname = usePathname();
  if (!adsReady || isHiddenPath(pathname)) return null;

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
