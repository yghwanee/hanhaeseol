"use client";

import { useEffect, useState } from "react";
import { INTRO_DONE_EVENT, isIntroDone } from "./IntroAnimation";

/**
 * 페이지의 **모든** 애드핏 슬롯이 공유하는 단 하나의 "이제 광고 붙여도 됨" 신호.
 *
 * 🔴 왜 공유해야 하나 — 애드핏 SDK 는 실행될 때 문서를 **한 번만** 훑고 끝난다
 * (`ba.min.js` 확인). 그래서 슬롯들이 서로 다른 시점에 마운트되면, 먼저 뜬 슬롯이 SDK 를
 * 붙여 스캔을 끝내버리고 **늦게 뜬 슬롯은 영구히 빈칸으로 남는다.**
 *
 * 실제로 그 버그를 겪었다(2026-07-30): 우측 사이드 배너는 인트로가 끝날 때까지(~1.2초)
 * `null` 을 렌더하는데 홈 상단 슬롯은 즉시 마운트돼 SDK 를 붙였고, 뒤늦게 나타난 우측
 * `<ins>` 는 아무도 스캔하지 않았다. `AdfitBanner` 의 2.5초 재스캔 안전망도 "채워진 광고가
 * 하나라도 있으면 재삽입 안 함" 조건 때문에 구제하지 못했다(상단이 이미 채워져 있으므로).
 *
 * **헤드리스 브라우저에서는 이 버그가 보이지 않는다** — SDK 가 헤드리스를 탐지해 아무것도
 * 채우지 않으므로 `hasFilledAd()` 가 false 가 되고 재스캔이 돌아버린다. 자동 검증으로
 * 잡히지 않는 부류라 구조로 막아야 한다.
 *
 * 그래서 타이머·이벤트 리스너를 **모듈 단위로 하나만** 두고 구독자 전원에게 동시에
 * 알린다. React 가 같은 커밋으로 묶어 처리하므로 모든 `<ins>` 가 함께 DOM 에 들어가고,
 * 그 뒤 첫 슬롯이 SDK 를 붙일 때 스캔이 전부를 잡는다.
 */

let ready = false;
let initialized = false;
const subscribers = new Set<() => void>();

function flush() {
  if (ready) return;
  ready = true;
  for (const notify of subscribers) notify();
}

/** 리스너·타이머를 페이지당 한 번만 만든다. */
function init() {
  if (initialized) return;
  initialized = true;

  if (isIntroDone()) {
    ready = true;
    return;
  }

  // 인트로가 있는 페이지(홈)는 종료 이벤트로, 없는 페이지(매치·about 등)는 이벤트가
  // 절대 오지 않으므로 폴백 타이머로 푼다. 인트로 오버레이가 화면을 덮은 동안 광고가
  // 노출로 집계되면 무효 노출이라, 기다리는 것 자체가 맞는 동작이다.
  window.addEventListener(INTRO_DONE_EVENT, flush);
  window.setTimeout(flush, 500);
}

/** 모든 애드핏 슬롯이 이 훅으로 같은 시점에 켜진다. */
export function useAdsReady(): boolean {
  const [value, setValue] = useState(false);

  useEffect(() => {
    init();
    if (ready) {
      setValue(true);
      return;
    }
    const notify = () => setValue(true);
    subscribers.add(notify);
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  return value;
}
