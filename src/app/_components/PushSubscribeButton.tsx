"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFollows } from "./use-follows";
import {
  currentSubscription,
  ensureSubscribed,
  pushConfigured,
  PUSH_SUB_EVENT,
  unsubscribePush,
} from "@/lib/push/client";

// 🔴 구독 조작·찜 동기화는 전부 `@/lib/push/client` 에 있다. 이 파일은 **컨트롤**만 그린다.
//    찜 목록을 서버에 올리는 일은 `PushFollowsSync` 가 맡는다(버튼이 사라져도 살아 있어야
//    하는 일이라 분리했다 — 2026-09-15 작업121).

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
  const { keys: follows } = useFollows();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // VAPID 미설정은 셋업 문제라 사용자에게 보일 게 없다 — 그때만 조용히 숨는다.
    if (!pushConfigured()) {
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
    const resync = () => {
      void currentSubscription().then((sub) => setState(sub ? "subscribed" : "idle"));
    };
    resync();
    window.addEventListener(PUSH_SUB_EVENT, resync);
    return () => window.removeEventListener(PUSH_SUB_EVENT, resync);
  }, []);

  const subscribe = async () => {
    setState("busy");
    const r = await ensureSubscribed(follows);
    if (r === "subscribed" || r === "already") {
      setState("subscribed");
      window.dispatchEvent(new Event(PUSH_SUB_EVENT));
      return;
    }
    setState(r === "denied" ? "denied" : "idle");
  };

  /**
   * 알림 끄기 = 구독 삭제(`unsubscribePush`).
   *
   * 🔴 알림 **권한**은 코드로 못 되돌린다(한 번 granted 면 브라우저 설정에서만 바꾼다).
   * 그래서 끄기는 이 구독을 지우는 것이고, 다시 켤 때는 프롬프트 없이 바로 켜진다.
   * 서버 삭제가 실패하면 **아예 끄지 않고 되돌린다** — 화면만 꺼지면 알림은 계속 온다.
   */
  const unsubscribe = async () => {
    setState("busy");
    const ok = await unsubscribePush();
    setState(ok ? "idle" : "subscribed");
    if (ok) window.dispatchEvent(new Event(PUSH_SUB_EVENT));
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
