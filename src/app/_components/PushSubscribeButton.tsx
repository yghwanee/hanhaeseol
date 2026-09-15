"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

type State =
  | "init"
  | "unsupported"
  | "iosInstall"
  | "inApp"
  | "idle"
  | "busy"
  | "subscribed"
  | "denied";

/**
 * 푸시를 못 쓰는 환경을 **이유별로** 가른다.
 *
 * 🔴 종전에는 `PushManager` 가 없으면 전부 `unsupported` 로 묶어 **아무 표시 없이 사라졌다.**
 * 그런데 iOS 사파리는 유입의 대부분이 오는 환경이고, 거기서는 홈 화면에 추가하기만 하면
 * 실제로 알림이 된다 — 즉 "못 쓰는 환경"이 아니라 **한 단계가 남은 환경**이다.
 * 아무것도 안 그리면 사용자는 별을 눌러 놓고 알림이 왜 안 오는지 알 방법이 없다
 * (2026-09-04 사용자 지적: "알림받기도 안 보이던데").
 *
 * 인앱 웹뷰(네이버·카카오 등)는 홈 화면 추가 자체가 없으므로 안내가 다르다.
 * 유입의 81% 가 네이버라 이 갈래를 뭉뚱그리면 안 된다.
 */
function unsupportedReason(): "iosInstall" | "inApp" | "unsupported" {
  const ua = navigator.userAgent;
  // 인앱 웹뷰. iOS·안드로이드 공통으로 여기서는 구독 자체가 안 걸린다.
  if (/NAVER|DaumApps|KAKAOTALK|KAKAOSTORY|Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(ua)) {
    return "inApp";
  }
  // 아이패드는 iPadOS 13+ 부터 UA 가 Macintosh 다. 터치 포인트로 가른다.
  const isIOS =
    /iP(hone|od|ad)/.test(ua) ||
    (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isIOS && !standalone) return "iosInstall";
  return "unsupported";
}

/**
 * 🔴 이 컴포넌트는 한 화면에 **둘** 걸려 있다(푸터·내 팀 섹션). 구독 상태를 각자
 * 마운트 때 한 번만 읽으면, 한쪽에서 구독을 켜도 다른 쪽은 계속 "알림 받기" 버튼을
 * 보여준다. 켠 순간 서로에게 알린다.
 */
const SUB_EVENT = "hhs:push-sub";

/** 이 기기가 서버에 마지막으로 올린 구독 주소. 주소가 바뀌면 옛 저장본을 지우게 하려고 둔다. */
const ENDPOINT_KEY = "hhs.push.endpoint.v1";
function readStoredEndpoint(): string | null {
  try {
    return localStorage.getItem(ENDPOINT_KEY);
  } catch {
    return null;
  }
}
function writeStoredEndpoint(endpoint: string | null): void {
  try {
    if (endpoint) localStorage.setItem(ENDPOINT_KEY, endpoint);
    else localStorage.removeItem(ENDPOINT_KEY);
  } catch {
    /* 저장 불가 환경 — 주소 교체 정리는 서비스워커 이벤트에 맡긴다 */
  }
}

/**
 * 마지막으로 서버에 찜을 올린 시각. **하트비트**의 기준이다.
 *
 * 🔴 서버는 오래 갱신 없는 구독을 발송에서 뺀다(`STALE_SUB_DAYS`) — 스스로 못 지우는
 * 유령이 영구히 사는 걸 막는 상한이다. 그런데 찜이 안 바뀌는 사람은 서버 쓰기가 아예
 * 안 나가므로, 그 상한이 **멀쩡한 구독까지** 자른다. 그래서 찜이 그대로여도 주 1회는
 * 올려 살아 있다고 알린다(구독자당 주 1회 쓰기라 비용은 없다).
 */
const SYNCED_AT_KEY = "hhs.push.syncedAt.v1";
const HEARTBEAT_MS = 7 * 24 * 60 * 60 * 1000;
function markSynced(): void {
  try {
    localStorage.setItem(SYNCED_AT_KEY, String(Date.now()));
  } catch {
    /* 저장 불가 환경 — 하트비트를 못 세면 매번 올린다(해가 없다) */
  }
}
function heartbeatDue(): boolean {
  try {
    const at = Number(localStorage.getItem(SYNCED_AT_KEY));
    return !Number.isFinite(at) || at <= 0 || Date.now() - at > HEARTBEAT_MS;
  } catch {
    return true;
  }
}

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
  /** 디바운스 대기 중인 찜 목록. 페이지가 사라질 때 이걸 beacon 으로 밀어낸다. */
  const pending = useRef<string[] | null>(null);

  const putFollows = useCallback(async (list: string[]) => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return false;
    // 🔴 이 기기가 지난번에 올린 구독 주소. 브라우저가 주소를 갈아끼웠으면 서버에 옛 주소를
    // 같이 알려 지우게 한다 — 안 그러면 옛 저장본이 옛 찜을 든 채 알림을 계속 받는다
    // (2026-09-15 "찜 다 풀었는데 푸시가 계속 온다"). 서비스워커의 교체 이벤트가 놓친 경우의 안전망.
    const previous = readStoredEndpoint();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        follows: list,
        ...(previous && previous !== sub.endpoint ? { previousEndpoint: previous } : {}),
      }),
    });
    if (res.ok) {
      lastSynced.current = JSON.stringify(list);
      pending.current = null;
      writeStoredEndpoint(sub.endpoint);
      markSynced();
    }
    return res.ok;
  }, []);

  /**
   * 아직 못 올린 찜 목록을 **떠나는 순간** 흘려보낸다.
   *
   * 🔴 재동기는 600ms 디바운스가 걸려 있다(별 연타에 쓰기가 그 횟수만큼 나가는 걸 막는다).
   * 그래서 별을 풀고 바로 탭을 닫으면 그 타이머가 취소돼 **해제가 영영 서버에 안 간다** —
   * 서버는 옛 찜으로 알림을 계속 보낸다(2026-09-15 "찜 다 풀었는데 푸시가 계속 와").
   *
   * `pagehide` 에서는 `fetch` 가 중간에 끊기므로 `sendBeacon` 을 쓴다. beacon 은 await 가
   * 안 되니 구독 키를 실을 수 없어, 저장해 둔 endpoint 로 찜만 갈아끼우는 전용 라우트를 부른다.
   */
  const flush = useCallback(() => {
    const list = pending.current;
    if (!list) return;
    const endpoint = readStoredEndpoint();
    if (!endpoint || typeof navigator.sendBeacon !== "function") return;
    try {
      const blob = new Blob([JSON.stringify({ endpoint, follows: list })], {
        type: "application/json",
      });
      if (navigator.sendBeacon("/api/push/follows", blob)) {
        lastSynced.current = JSON.stringify(list);
        pending.current = null;
        markSynced();
      }
    } catch {
      /* 떠나는 길이라 더 할 수 있는 게 없다 */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // VAPID 미설정은 셋업 문제라 사용자에게 보일 게 없다 — 그때만 조용히 숨는다.
    if (!VAPID) {
      setState("unsupported");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState(unsupportedReason());
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
  // 🔴 세 가지를 막는다.
  //   ① 이 컴포넌트는 한 화면에 **둘** 걸려 있다(푸터·내 팀 섹션). 둘 다 동기화하면
  //      찜 한 번에 서버 쓰기가 두 번 간다. `ctaOnly` 쪽은 동기화에서 빠진다
  //      (`return null` 은 훅 뒤에 실행되므로 렌더를 막아도 effect 는 돈다).
  //   ② 별을 연타하면 그 횟수만큼 쓰기가 나간다. 마지막 상태 하나만 보내면 된다.
  //   ③ 🔴 **`state` 로 막지 않는다.** 종전에는 state 가 subscribed 가 아니면 그냥 돌아갔는데,
  //      `state` 는 마운트 때 `navigator.serviceWorker.ready` → `getSubscription()` 한 번으로
  //      정해지고 **다시 판정하지 않는다.** 그 조회가 늦거나 실패해 `idle` 로 굳으면 그
  //      브라우저는 찜을 풀어도 서버에 영영 못 알리고, 서버는 옛 찜으로 계속 보낸다
  //      (2026-09-15 실측: 구독 3건이 11일째 9/03~04 상태 그대로였다).
  //      구독이 실제로 있는지는 `putFollows` 안의 `getSubscription()` 이 그때그때 판정한다.
  useEffect(() => {
    if (ctaOnly || !ready) return;
    // 구독 자체가 불가능한 환경만 뺀다. 여기서 더 조이면 위 ③ 이 재발한다.
    if (state === "unsupported" || state === "iosInstall" || state === "inApp" || state === "denied") {
      return;
    }
    const snapshot = JSON.stringify(follows);
    if (lastSynced.current === snapshot && !heartbeatDue()) return;
    pending.current = follows;
    const id = setTimeout(() => {
      void putFollows(follows).catch(() => {});
    }, 600);
    return () => clearTimeout(id);
  }, [ctaOnly, state, ready, follows, putFollows]);

  // 페이지를 떠나는 순간, 아직 못 올린 해제를 밀어낸다(위 flush 주석 참조).
  // 모바일 브라우저는 `beforeunload` 를 안 주는 경우가 많아 `pagehide` + 탭 숨김을 같이 본다.
  useEffect(() => {
    if (ctaOnly) return;
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      // 언마운트도 마지막 기회다.
      flush();
    };
  }, [ctaOnly, flush]);

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
      writeStoredEndpoint(null);
      lastSynced.current = null;
      // 🔴 대기 중이던 찜 갱신을 버린다. 안 그러면 방금 지운 구독으로 beacon 이 날아가
      //    저장본이 되살아난다(서버는 모르는 endpoint 를 그냥 넘기지만, 순서가 엇갈리면
      //    삭제 전 저장본에 찜이 다시 실린다).
      pending.current = null;
      setState("idle");
      window.dispatchEvent(new Event(SUB_EVENT));
    } catch {
      setState("subscribed");
    }
  };

  if (state === "init" || state === "unsupported") return null;
  if (state === "denied")
    return <span className="text-fg-tertiary">알림 차단됨 (브라우저 설정에서 허용)</span>;

  // 🔴 여기서 `null` 을 돌려주면 종전 상태로 돌아간다 — 별은 눌리는데 알림 자리는
  // 비어 있어서, 사용자는 자기가 뭘 더 해야 하는지 영영 모른다. `test:push-toggle` 이 막는다.
  if (state === "iosInstall")
    return (
      <Hint>
        아이폰은 <b className="font-semibold text-fg">공유 → 홈 화면에 추가</b> 후
        알림을 켤 수 있어요
      </Hint>
    );
  if (state === "inApp")
    return <Hint>알림은 앱 안 브라우저에서 안 돼요. 사파리·크롬으로 열어 주세요</Hint>;

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
        <span className="text-fg-brand-bright">
          {follows.length > 0 ? `내 팀 ${follows.length}개` : "팀을 찜하면 알림이 옵니다"}
        </span>
      </span>
    );
  }

  return <Toggle on={false} onClick={subscribe} busy={state === "busy"} />;
}

/**
 * 푸시를 아직 못 쓰는 환경에 남길 한 줄.
 *
 * 버튼처럼 보이면 안 된다 — 누를 게 없다. 종모양만 같이 둬서 "알림 자리"라는 건 알린다.
 */
function Hint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-tertiary">
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden>
        <path d="M12 2a6 6 0 00-6 6v3.6l-1.7 3.2A1 1 0 005.2 17h13.6a1 1 0 00.9-1.2l-1.7-3.2V8a6 6 0 00-6-6zm0 19a2.8 2.8 0 002.7-2h-5.4A2.8 2.8 0 0012 21z" />
      </svg>
      <span className="break-keep">{children}</span>
    </span>
  );
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
          ? "border-brand/40 bg-brand-subtle text-fg-brand-bright hover:border-brand/40"
          : "border-line text-fg-secondary hover:border-line-strong hover:text-fg-strong"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden>
        <path d="M12 2a6 6 0 00-6 6v3.6l-1.7 3.2A1 1 0 005.2 17h13.6a1 1 0 00.9-1.2l-1.7-3.2V8a6 6 0 00-6-6zm0 19a2.8 2.8 0 002.7-2h-5.4A2.8 2.8 0 0012 21z" />
      </svg>
      <span>{busy ? "적용중" : on ? "알림 켜짐" : "알림 받기"}</span>
      {/* 스위치 — 글자를 안 읽어도 상태가 보인다 */}
      <span
        className={`ml-0.5 flex h-3 w-5 shrink-0 items-center rounded-full px-[2px] transition-colors ${
          on ? "bg-brand-subtle" : "bg-muted"
        }`}
        aria-hidden
      >
        <span
          className={`h-2 w-2 rounded-full bg-fg-strong transition-transform ${on ? "translate-x-[10px]" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}
