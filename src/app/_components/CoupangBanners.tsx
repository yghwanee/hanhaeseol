"use client";

import { useEffect, useState } from "react";

function AdSkeleton({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-xl ${className ?? ""}`} />;
}

function useShowAds() {
  const [showAds, setShowAds] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowAds(true), 1500);
    return () => clearTimeout(timer);
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
        {showAds ? (
          <a
            href="https://link.coupang.com/a/ekC6YT"
            target="_blank"
            rel="nofollow sponsored noopener"
            referrerPolicy="unsafe-url"
            className="w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://ads-partners.coupang.com/banners/979237?subId=mobile-top&traceId=V0-301-371ae01f4226dec2-I979237&w=320&h=50"
              alt="쿠팡플레이 스포츠 중계 배너"
              className="w-full h-auto"
              loading="lazy"
            />
          </a>
        ) : (
          <AdSkeleton className="w-full h-[50px]" />
        )}
      </div>
      <div className="hidden sm:flex justify-center mb-6">
        <div className="rounded-xl overflow-hidden w-full max-w-2xl">
          {showAds ? (
            <iframe
              title="쿠팡 파트너스 광고 (PC 상단)"
              src="https://ads-partners.coupang.com/widgets.html?id=979114&template=banner&trackingCode=AF2259406&subId=pc-top&width=728&height=90"
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
