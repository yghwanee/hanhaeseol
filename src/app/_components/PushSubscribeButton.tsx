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
 * 🔴 이 컴포넌트는 한 화면에 **둘** 걸려 있다(푸터·내 팀 섹션). 구독 상태를 각자
 * 마운트 때 한 번만 읽으면, 한쪽에서 구독을 켜도 다른 쪽은 계속 "알림 받기" 버튼을
 * 보여준다. 켠 순간 서로에게 알린다.
 */
const SUB_EVENT = "hhs:push-sub";

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
export function PushSubscribeButton({
  /**
   * 구독을 이미 켠 뒤에는 렌더하지 않는다. 이 버튼이 **푸터와 내 팀 섹션 두 곳**에
   * 걸려 있어서, 켜고 나면 같은 문구가 한 화면에 두 번 뜬다. 내 팀 섹션 쪽은
   * "켜라"는 권유가 목적이므로 켜진 뒤에는 빠지고, 상태 표시는 푸터 하나가 맡는다.
   */
  ctaOnly = false,
}: { ctaOnly?: boolean } = {}) {
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

    const resync = () => {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setState(sub ? "subscribed" : "idle"))
        .catch(() => {});
    };
    window.addEventListener(SUB_EVENT, resync);
    return () => window.removeEventListener(SUB_EVENT, resync);
  }, []);

  // 찜 목록이 바뀌면 서버의 구독 정보를 갱신한다.
  //
  // 🔴 두 가지를 막는다.
  //   ① 이 컴포넌트는 한 화면에 **둘** 걸려 있다(푸터·내 팀 섹션). 둘 다 동기화하면
  //      찜 한 번에 서버 쓰기가 두 번 간다. `ctaOnly` 쪽은 동기화에서 빠진다
  //      (`return null` 은 훅 뒤에 실행되므로 렌더를 막아도 effect 는 돈다).
  //   ② 별을 연타하면 그 횟수만큼 쓰기가 나간다. 마지막 상태 하나만 보내면 된다.
  useEffect(() => {
    if (ctaOnly) return;
    if (state !== "subscribed" || !ready) return;
    const snapshot = JSON.stringify(follows);
    if (lastSynced.current === snapshot) return;
    const id = setTimeout(() => {
      void putFollows(follows).catch(() => {});
    }, 600);
    return () => clearTimeout(id);
  }, [ctaOnly, state, ready, follows, putFollows]);

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
      if (ok) window.dispatchEvent(new Event(SUB_EVENT));
    } catch {
      setState("idle");
    }
  };

  if (state === "init" || state === "unsupported") return null;
  if (state === "denied")
    return <span className="text-zinc-500">알림 차단됨 (브라우저 설정에서 허용)</span>;

  if (state === "subscribed") {
    if (ctaOnly) return null;
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
      🔔 알림 받기
    </button>
  );
}
