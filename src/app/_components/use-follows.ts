"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FOLLOWS_STORAGE_KEY,
  readFollows,
  toggleFollow,
  writeFollows,
} from "@/lib/follows";

/** 같은 탭 안 다른 컴포넌트에 변경을 알린다(storage 이벤트는 다른 탭에만 간다). */
const SYNC_EVENT = "hhs:follows";

/**
 * ⭐찜한 팀 훅.
 *
 * 🔴 첫 렌더는 **반드시 빈 배열**이다. 서버 HTML 에는 찜이 없으므로, 마운트 전에 로컬
 * 저장소를 읽으면 하이드레이션이 어긋난다. 읽기는 effect 에서만 한다.
 */
export function useFollows() {
  const [keys, setKeys] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  // 저장·이벤트 발행을 setState 업데이터 밖에서 하기 위한 최신값 거울.
  const keysRef = useRef<string[]>([]);

  useEffect(() => {
    const load = () => {
      const next = readFollows();
      keysRef.current = next;
      setKeys(next);
    };
    load();
    setReady(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === FOLLOWS_STORAGE_KEY) load();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SYNC_EVENT, load);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SYNC_EVENT, load);
    };
  }, []);

  const toggle = useCallback((key: string) => {
    const next = toggleFollow(keysRef.current, key);
    keysRef.current = next;
    setKeys(next);
    writeFollows(next);
    // 같은 화면의 다른 카드·필터 칩이 즉시 따라오게 한다.
    window.dispatchEvent(new Event(SYNC_EVENT));
  }, []);

  return { keys, toggle, ready };
}
