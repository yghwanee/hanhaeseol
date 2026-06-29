"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "hhs-install-dismissed";

type Platform = "ios" | "android" | "desktop";

// 앱 설치 유도 배너.
// 핵심: "설치 안 됨(standalone 아님)"이면 무조건 노출 — beforeinstallprompt 이벤트
// 유무에 의존하지 않음(그 이벤트는 이미 설치됐거나 막 지운 직후엔 안 와서, 배너가
// 영영 안 뜨는 문제가 있었음).
//  - 설치 이벤트(deferred) 있으면 → [설치] 버튼(원클릭 설치, 안드/PC)
//  - 없으면 → 플랫폼별 수동 안내(아이폰=공유, 안드=메뉴, PC=주소창 아이콘)
// 한 번 닫으면 그 탭(세션)만 숨김(sessionStorage). 새 탭/새 창이면 다시 노출.
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [iosSafari, setIosSafari] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    // 이미 설치(standalone)면 안내 불필요.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // 플랫폼 감지
    const ua = window.navigator.userAgent;
    const isIos =
      /iphone|ipad|ipod/i.test(ua) ||
      // iPadOS는 데스크톱 UA로 위장 → 터치 가능한 Mac으로 판별
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isAndroid = /android/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    setPlatform(isIos ? "ios" : isAndroid ? "android" : "desktop");
    setIosSafari(isIos && isSafari);

    setDismissed(false);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    // 설치 완료되면 즉시 닫기.
    const onInstalled = () => close();
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // 일정 이상 내려가면 노출, 다시 위로 올라오면 숨김(스크롤 위치 추종).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    close();
  };

  if (dismissed) return null;
  if (!scrolled) return null;

  // 안내 문구: 설치 이벤트 있으면 원클릭, 없으면 플랫폼별 수동 안내.
  let body: React.ReactNode;
  if (deferred) {
    body = (
      <span>
        자주 보는 한해설, <b className="text-white">홈 화면에 추가</b>하고 더 빠르게!
      </span>
    );
  } else if (platform === "ios") {
    body = iosSafari ? (
      <span>
        <b className="text-white">공유</b> → <b className="text-white">홈 화면에 추가</b>하면
        앱처럼 한 번에 열려요.
      </span>
    ) : (
      <span>
        <b className="text-white">Safari</b>로 열어 <b className="text-white">공유 → 홈 화면에 추가</b>하면 끝!
      </span>
    );
  } else if (platform === "android") {
    body = (
      <span>
        <b className="text-white">메뉴(⋮)</b> → <b className="text-white">앱 설치</b>면
        홈 화면에서 바로 열려요.
      </span>
    );
  } else {
    body = (
      <span>
        주소창 끝 <b className="text-white">설치 아이콘</b>을 누르면 앱처럼 쓸 수 있어요.
      </span>
    );
  }

  return (
    <div className="liquid-glass fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl p-3.5 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] sm:inset-x-auto sm:right-4">
      <div className="relative z-10 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon-192x192.png"
          alt="한해설"
          className="h-9 w-9 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1 text-xs font-medium text-white sm:text-sm">{body}</div>
        {deferred && (
          <button
            onClick={install}
            className="shrink-0 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 [text-shadow:none]"
          >
            설치
          </button>
        )}
        <button
          onClick={close}
          aria-label="닫기"
          className="shrink-0 rounded-md px-1.5 py-1 text-white/70 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
