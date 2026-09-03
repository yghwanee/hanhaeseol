"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFollows } from "./use-follows";

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

/**
 * ⭐찜한 팀 경기 알림 구독 버튼.
 *
 * 🔴 **찜한 팀이 없으면 알림도 없다.** 서버는 구독에 실린 팀 키와 겹치는 경기만 보낸다
 * (`shouldReceive`). 그래서 찜 목록이 바뀌면 서버에 다시 올려야 한다 — 아래 재동기 effect 가
 * 그 일을 한다. 이게 없으면 나중에 찜한 팀 알림이 영영 안 온다.
 *
 * 플랫폼: 안드로이드·PC 는 설치 없이 이 버튼만으로 된다. 아이폰은 홈 화면에 추가해야
 * `PushManager` 가 생긴다(그전에는 `unsupported` 로 떨어져 버튼이 숨는다).
 */
export function PushSubscribeButton() {
  const [state, setState] = useState<State>("init");
  const { keys: follows, ready } = useFollows();
  const lastSynced = useRef<string | null>(null);

  const putFollows = useCallback(async (list: string[]) => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return false;
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), follows: list }),
    });
    if (res.ok) lastSynced.current = JSON.stringify(list);
    return res.ok;
  }, []);

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

  // 찜 목록이 바뀌면 서버의 구독 정보를 갱신한다.
  useEffect(() => {
    if (state !== "subscribed" || !ready) return;
    const snapshot = JSON.stringify(follows);
    if (lastSynced.current === snapshot) return;
    void putFollows(follows).catch(() => {});
  }, [state, ready, follows, putFollows]);

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
      await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
      });
      const ok = await putFollows(follows);
      setState(ok ? "subscribed" : "idle");
    } catch {
      setState("idle");
    }
  };

  if (state === "init" || state === "unsupported") return null;
  if (state === "denied")
    return <span className="text-zinc-500">알림 차단됨 (브라우저 설정에서 허용)</span>;

  if (state === "subscribed") {
    return (
      <span className="text-emerald-400">
        {follows.length > 0
          ? `🔔 내 팀 ${follows.length}개 알림 켜짐`
          : "🔔 알림 켜짐 · 팀을 찜하면 알림이 옵니다"}
      </span>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={state === "busy"}
      className="transition-colors hover:text-white disabled:opacity-50"
    >
      🔔 내 팀 경기 알림 받기
    </button>
  );
}
