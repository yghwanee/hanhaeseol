"use client";

import { useEffect, useState } from "react";
import { AdSkeleton } from "./AdSkeleton";
import { INTRO_DONE_EVENT } from "./IntroAnimation";

const INTRO_STORAGE_KEY = "haeseol-intro-seen";

/** 인트로(fixed z-[100] bg-zinc-950) 가 끝난 뒤 광고 노출.
 *  사이드 배너(z-10 fixed)가 인트로 fadeout 중 AdSkeleton 깜빡임으로 비치는
 *  문제 방지 + 페이지 본격 노출 시점에 맞춰 광고도 등장. */
function useShowAds() {
  const [showAds, setShowAds] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 인트로 이미 본 경우(재진입 ripple): 짧은 ripple 끝나면 INTRO_DONE_EVENT 가
    // 옴. flag 만 보고 즉시 띄우면 ripple 도중 비침. listener 로 통일.
    const reveal = () => setShowAds(true);

    // 이미 done 된 상태(내부 SPA 재진입 등)면 flag 가 있을 거. 그땐 살짝 지연 후
    // 표시 (이벤트 못 받을 수도 있어 fallback).
    const fallback = setTimeout(() => {
      if (sessionStorage.getItem(INTRO_STORAGE_KEY) === "1") setShowAds(true);
    }, 100);

    window.addEventListener(INTRO_DONE_EVENT, reveal);
    return () => {
      clearTimeout(fallback);
      window.removeEventListener(INTRO_DONE_EVENT, reveal);
    };
  }, []);
  return showAds;
}

export function CoupangSideBanners() {
  const showAds = useShowAds();
  return (
    <>
      <div className="hidden xl:block fixed left-4 top-1/2 -translate-y-1/2 z-10 rounded-xl overflow-hidden shadow-lg shadow-black/20">
        {showAds ? (
          <iframe
            title="쿠팡 파트너스 광고 (좌측 사이드)"
            src="https://ads-partners.coupang.com/widgets.html?id=979121&template=carousel&trackingCode=AF2259406&subId=sidebar-left&width=160&height=600&tsource="
            width="160"
            height="600"
            frameBorder="0"
            scrolling="no"
            referrerPolicy="unsafe-url"
            loading="lazy"
          />
        ) : (
          <AdSkeleton className="w-[160px] h-[600px]" />
        )}
      </div>
      <div className="hidden xl:block fixed right-4 top-1/2 -translate-y-1/2 z-10 rounded-xl overflow-hidden shadow-lg shadow-black/20">
        {showAds ? (
          <iframe
            title="쿠팡 파트너스 광고 (우측 사이드)"
            src="https://ads-partners.coupang.com/widgets.html?id=979133&template=carousel&trackingCode=AF2259406&subId=sidebar-right&width=160&height=600&tsource="
            width="160"
            height="600"
            frameBorder="0"
            scrolling="no"
            referrerPolicy="unsafe-url"
            loading="lazy"
          />
        ) : (
          <AdSkeleton className="w-[160px] h-[600px]" />
        )}
      </div>
    </>
  );
}

export function CoupangTopBannerOnly() {
  const showAds = useShowAds();
  return (
    <>
      <div className="sm:hidden flex justify-center mb-4">
        <div className="rounded-xl overflow-hidden w-full" style={{ aspectRatio: "728/90" }}>
          {showAds ? (
            <iframe
              title="쿠팡 파트너스 광고 (모바일 상단)"
              src="https://ads-partners.coupang.com/widgets.html?id=979107&template=banner&trackingCode=AF2259406&subId=mobile-top&width=728&height=90"
              className="w-full h-full border-0 rounded-xl"
              scrolling="no"
              referrerPolicy="unsafe-url"
              loading="lazy"
            />
          ) : (
            <AdSkeleton className="w-full h-full rounded-xl" />
          )}
        </div>
      </div>
      <div className="hidden sm:flex justify-center mb-6">
        <div className="rounded-xl overflow-hidden w-full max-w-2xl">
          {showAds ? (
            <iframe
              title="쿠팡 파트너스 광고 (PC 상단)"
              src="https://ads-partners.coupang.com/widgets.html?id=979107&template=banner&trackingCode=AF2259406&subId=pc-top&width=728&height=90"
              className="w-full h-[90px] border-0 rounded-xl"
              scrolling="no"
              referrerPolicy="unsafe-url"
              loading="lazy"
            />
          ) : (
            <AdSkeleton className="w-full h-[90px] rounded-xl" />
          )}
        </div>
      </div>
    </>
  );
}

export function CoupangTopBanner() {
  const showAds = useShowAds();
  return (
    <>
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-center mb-4">
        <p className="text-[11px] sm:text-xs text-zinc-400">
          이 포스팅은 쿠팡 파트너스 활동의 일환으로,
          <br className="sm:hidden" /> 이에 따른 일정액의 수수료를 제공받습니다.
        </p>
      </div>
      <div className="sm:hidden flex justify-center mb-4">
        <div className="rounded-xl overflow-hidden w-full" style={{ aspectRatio: "728/90" }}>
          {showAds ? (
            <iframe
              title="쿠팡 파트너스 광고 (모바일 상단)"
              src="https://ads-partners.coupang.com/widgets.html?id=979107&template=banner&trackingCode=AF2259406&subId=mobile-top&width=728&height=90"
              className="w-full h-full border-0 rounded-xl"
              scrolling="no"
              referrerPolicy="unsafe-url"
              loading="lazy"
            />
          ) : (
            <AdSkeleton className="w-full h-full rounded-xl" />
          )}
        </div>
      </div>
      <div className="hidden sm:flex justify-center mb-6">
        <div className="rounded-xl overflow-hidden w-full max-w-2xl">
          {showAds ? (
            <iframe
              title="쿠팡 파트너스 광고 (PC 상단)"
              src="https://ads-partners.coupang.com/widgets.html?id=979107&template=banner&trackingCode=AF2259406&subId=pc-top&width=728&height=90"
              className="w-full h-[90px] border-0 rounded-xl"
              scrolling="no"
              referrerPolicy="unsafe-url"
              loading="lazy"
            />
          ) : (
            <AdSkeleton className="w-full h-[90px] rounded-xl" />
          )}
        </div>
      </div>
    </>
  );
}
