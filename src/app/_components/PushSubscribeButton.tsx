"use client";

import { useEffect, useState } from "react";

// VAPID 공개키(빌드시 인라인). 미설정이면 버튼 자체를 숨김.
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "init" | "unsupported" | "idle" | "busy" | "subscribed" | "denied";

// 경기 알림 구독 버튼 (#1 A단계). 권한 요청 → pushManager.subscribe → /api/push/subscribe.
// 찜(팀 선택)은 B단계에서 붙인다. 현재는 전체 구독만.
export function PushSubscribeButton() {
  const [state, setState] = useState<State>("init");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "subscribed" : "idle"))
      .catch(() => setState("idle"));
  }, []);

  const subscribe = async () => {
    if (!VAPID) return;
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "idle");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), follows: [] }),
      });
      setState(res.ok ? "subscribed" : "idle");
    } catch {
      setState("idle");
    }
  };

  if (state === "init" || state === "unsupported") return null;
  if (state === "subscribed") return <span className="text-emerald-400">🔔 알림 구독중</span>;
  if (state === "denied")
    return <span className="text-zinc-500">알림 차단됨 (브라우저 설정에서 허용)</span>;
  return (
    <button
      onClick={subscribe}
      disabled={state === "busy"}
      className="transition-colors hover:text-white disabled:opacity-50"
    >
      🔔 경기 알림 받기
    </button>
  );
}
