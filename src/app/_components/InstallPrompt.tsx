"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "hhs-install-dismissed";

// 앱 설치 유도 배너. 안드로이드/PC는 beforeinstallprompt로 설치 버튼,
// iOS Safari는 이벤트가 없어 "공유 → 홈 화면에 추가" 안내를 보여준다.
// 한 번 닫으면 localStorage로 다시 안 띄움.
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    // 이미 설치(standalone)면 안내 불필요.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari standalone 플래그
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    setDismissed(false);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS 감지(beforeinstallprompt 미발생) → 수동 안내.
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIos && isSafari) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const close = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    close();
  };

  if (dismissed) return null;
  if (!deferred && !showIosHint) return null;

  return (
    <div className="liquid-glass fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl p-3.5 sm:inset-x-auto sm:right-4">
      <div className="relative z-10 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon-192x192.png"
          alt="한해설"
          className="h-9 w-9 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1 text-xs font-medium text-zinc-800 sm:text-sm">
          {deferred ? (
            <span>한해설을 앱처럼 홈 화면에 추가하세요.</span>
          ) : (
            <span>
              <b className="text-black">공유</b> 버튼 → <b className="text-black">홈 화면에 추가</b>로
              앱처럼 설치할 수 있어요.
            </span>
          )}
        </div>
        {deferred && (
          <button
            onClick={install}
            className="shrink-0 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500"
          >
            설치
          </button>
        )}
        <button
          onClick={close}
          aria-label="닫기"
          className="shrink-0 rounded-md px-1.5 py-1 text-zinc-500 hover:text-zinc-800"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
