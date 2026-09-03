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
   * 내 팀 섹션(카드 안)에 놓는 축약형. 푸터 쪽은 이 값을 주지 않는다.
   *
   * 🔴 켜진 뒤에도 **숨지 않는다.** 종전에는 중복을 피하려고 `null` 을 돌려줬는데,
   * 그러면 상태 표시가 푸터 하나만 남고 그 푸터는 편성 카드 수십 장 아래라 방금 별을
   * 누른 사람이 켜졌는지 알 수 없었다(2026-09-04 사용자 지적). 두 곳은 같은 화면에
   * 안 걸리므로 카드 안에는 짧게("알림 켜짐"), 푸터에는 전체 문구를 그린다.
   *
   * 찜 목록 재동기는 이쪽에서 하지 않는다 — 푸터 인스턴스가 맡는다(아래 effect).
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

  /**
   * 알림 끄기.
   *
   * 🔴 **서버에서 먼저 지우고, 그다음 로컬 구독을 해제한다.** 반대 순서면 로컬을 지운 뒤
   * 서버 삭제가 실패했을 때 endpoint 를 잃어버려 **영영 지울 수 없는 유령 구독**이 남는다
   * (화면은 "꺼짐"인데 알림은 계속 온다). 서버 삭제가 실패하면 아예 끄지 않고 되돌린다.
   *
   * 🔴 알림 **권한**은 코드로 못 되돌린다(한 번 granted 면 브라우저 설정에서만 바꾼다).
   * 그래서 끄기는 구독을 지우는 것이고, 다시 켤 때는 프롬프트 없이 바로 켜진다.
   */
  const unsubscribe = async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setState("idle");
        window.dispatchEvent(new Event(SUB_EVENT));
        return;
      }
      const res = await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      if (!res.ok) {
        setState("subscribed");
        return;
      }
      await sub.unsubscribe().catch(() => {});
      lastSynced.current = null;
      setState("idle");
      window.dispatchEvent(new Event(SUB_EVENT));
    } catch {
      setState("subscribed");
    }
  };

  if (state === "init" || state === "unsupported") return null;
  if (state === "denied")
    return <span className="text-zinc-500">알림 차단됨 (브라우저 설정에서 허용)</span>;

  if (state === "subscribed") {
    // 🔴 종전에는 `ctaOnly` 면 **아무것도 안 그렸다**(중복 표시를 피하려고). 그런데 남는
    // 표시가 푸터 하나뿐이라, 방금 별을 누른 사람은 **켜졌는지 알 방법이 없었다** —
    // 푸터는 편성 카드 수십 장 아래라 아무도 안 내려간다(2026-09-04 사용자 지적).
    // 두 곳은 애초에 같은 화면에 없어서 "두 번 뜬다"는 걱정이 과했다.
    // 카드 안에서는 짧게(팀 목록이 바로 위에 있으니 개수는 군더더기), 푸터에서는 전체를.
    if (ctaOnly) return <Toggle on onClick={unsubscribe} />;
    return (
      <span className="inline-flex items-center gap-2">
        <Toggle on onClick={unsubscribe} />
        <span className="text-emerald-400/70">
          {follows.length > 0 ? `내 팀 ${follows.length}개` : "팀을 찜하면 알림이 옵니다"}
        </span>
      </span>
    );
  }

  return <Toggle on={false} onClick={subscribe} busy={state === "busy"} />;
}

/**
 * 알림 on/off 토글.
 *
 * 🔴 **상태와 동작을 한 컨트롤로 합친다.** 종전에는 꺼진 상태만 버튼("알림 받기")이고 켜진
 * 뒤에는 글자("알림 켜짐")로 바뀌어, 켠 사람이 **끌 방법이 화면에 없었다**(2026-09-04
 * 사용자 지적). 한 번 누르면 켜지고 다시 누르면 꺼지는 게 사람이 기대하는 동작이다.
 *
 * 스위치 손잡이가 좌↔우로 움직여 지금 어느 상태인지 글자를 안 읽어도 보인다.
 * `aria-pressed` 로 스크린리더에도 같은 정보를 준다.
 */
function Toggle({
  on,
  onClick,
  busy = false,
}: {
  on: boolean;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      aria-label={on ? "경기 알림 끄기" : "경기 알림 받기"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-400 ${
        on
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:border-emerald-400/60"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden>
        <path d="M12 2a6 6 0 00-6 6v3.6l-1.7 3.2A1 1 0 005.2 17h13.6a1 1 0 00.9-1.2l-1.7-3.2V8a6 6 0 00-6-6zm0 19a2.8 2.8 0 002.7-2h-5.4A2.8 2.8 0 0012 21z" />
      </svg>
      <span>{busy ? "잠시만" : on ? "알림 켜짐" : "알림 받기"}</span>
      {/* 스위치 — 글자를 안 읽어도 상태가 보인다 */}
      <span
        className={`ml-0.5 flex h-3 w-5 shrink-0 items-center rounded-full px-[2px] transition-colors ${
          on ? "bg-emerald-500/70" : "bg-zinc-700"
        }`}
        aria-hidden
      >
        <span
          className={`h-2 w-2 rounded-full bg-white transition-transform ${on ? "translate-x-[10px]" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}
