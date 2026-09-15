"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFollows } from "./use-follows";
import {
  beaconFollows,
  heartbeatDue,
  markSynced,
  pushUnavailable,
  putFollows,
} from "@/lib/push/client";

/**
 * ⭐찜 목록을 서버 구독에 반영하는 **보이지 않는 동기화기**. 레이아웃에 한 번만 건다.
 *
 * 🔴 **버튼과 분리한 이유가 전부다.** 종전에는 이 일을 `PushSubscribeButton`(푸터 인스턴스)
 * 이 겸했다. 그래서 그 버튼이 화면에서 사라지는 순간 — 푸터에서 빼거나, 찜이 0개가 돼
 * 「내 팀」 섹션이 통째로 없어지거나 — **찜 변경을 서버에 알릴 주체가 같이 사라졌다.**
 * 찜을 전부 푼 사람에게 알림이 계속 가던 고장이 이 구조에서 났다(2026-09-15 작업121).
 * 동기화는 버튼의 수명이 아니라 **페이지의 수명**을 따라야 한다.
 *
 * 🔴 구독 유무를 `state` 같은 걸로 미리 재지 않는다. 서비스워커 조회는 늦거나 실패할 수
 * 있고, 한 번 실패한 판정을 들고 있으면 그 브라우저는 영영 못 알린다. 구독이 실제로
 * 있는지는 `putFollows` 안의 `getSubscription()` 이 그때그때 본다.
 */
export function PushFollowsSync() {
  const { keys: follows, ready } = useFollows();
  const lastSynced = useRef<string | null>(null);
  /** 디바운스 대기 중인 찜 목록. 페이지가 사라질 때 이걸 beacon 으로 밀어낸다. */
  const pending = useRef<string[] | null>(null);

  const flush = useCallback(() => {
    const list = pending.current;
    if (!list) return;
    if (beaconFollows(list)) {
      lastSynced.current = JSON.stringify(list);
      pending.current = null;
    }
  }, []);

  // 찜이 바뀌면(또는 하트비트 주기가 되면) 서버에 올린다.
  // 🔴 디바운스는 별 연타에 쓰기가 그 횟수만큼 나가는 걸 막는 것이지, 보내기를 미루는
  //    장치가 아니다 — 못 보낸 채 페이지가 사라지면 아래 flush 가 받는다.
  useEffect(() => {
    if (!ready || pushUnavailable()) return;
    const snapshot = JSON.stringify(follows);
    if (lastSynced.current === snapshot && !heartbeatDue()) return;
    pending.current = follows;
    const id = setTimeout(() => {
      void putFollows(follows)
        .then((ok) => {
          if (!ok) return;
          lastSynced.current = snapshot;
          pending.current = null;
          markSynced();
        })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(id);
  }, [ready, follows]);

  // 떠나는 순간 못 보낸 것을 밀어낸다. 모바일은 `beforeunload` 가 안 오는 경우가 많아
  // `pagehide` 와 탭 숨김을 같이 본다.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
  }, [flush]);

  return null;
}
