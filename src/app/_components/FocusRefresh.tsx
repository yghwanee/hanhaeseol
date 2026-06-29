"use client";

import { useEffect } from "react";

// 앱 복귀 시 자동 새로고침.
// 설치형(standalone)에서, 백그라운드로 일정 시간 이상 떠나 있다 다시 열면 최신본 reload.
// 잠깐 앱 전환(메시지 확인 등)엔 동작 안 함 — 임계값으로 거름.
// 라이브 스코어는 별도 폴링이 처리하므로, 이건 편성/결과/배포본 최신화 용도.
const AWAY_THRESHOLD_MS = 5 * 60 * 1000; // 5분 이상 떠나 있었으면 새로고침

export function FocusRefresh() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      // 다시 보이게 됨
      if (hiddenAt && Date.now() - hiddenAt >= AWAY_THRESHOLD_MS) {
        window.location.reload();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return null;
}
