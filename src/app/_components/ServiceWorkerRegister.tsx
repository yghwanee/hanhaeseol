"use client";

import { useEffect } from "react";

// 서비스워커(/sw.js) 등록. PWA 설치 + 웹푸시 수신의 토대.
// 실패해도 사이트 동작에 영향 없도록 조용히 무시.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
