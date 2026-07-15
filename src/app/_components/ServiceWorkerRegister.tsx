"use client";

import { useEffect } from "react";

// 서비스워커(/sw.js) 등록. PWA 설치 + 웹푸시 수신의 토대.
// 실패해도 사이트 동작에 영향 없도록 조용히 무시.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // updateViaCache:"none" — sw.js 자체를 HTTP 캐시에서 꺼내 쓰지 않게 해
    // 워커 갱신(예: 캐시 전략 수정)이 지연 없이 반영되도록 한다.
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
