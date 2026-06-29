"use client";

import { useEffect, useRef, useState } from "react";

// 당겨서 새로고침(pull-to-refresh).
// 설치형(standalone)에서만 동작 — 일반 브라우저는 자체 당겨서 새로고침이 있어 충돌 방지.
// 맨 위(scrollY=0)에서 아래로 끌면 인디케이터가 따라오고, 임계값 넘겨 놓으면 reload.
const THRESHOLD = 70; // 이만큼 당기면 새로고침
const MAX = 90; // 최대 당김(고무줄 저항)

export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const startY = useRef(0);
  const active = useRef(false);

  const apply = (v: number) => {
    pullRef.current = v;
    setPull(v);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing) {
        active.current = false;
        return;
      }
      startY.current = e.touches[0].clientY;
      active.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!active.current) return;
      const dy = e.touches[0].clientY - startY.current;
      // 위로 스크롤 중이거나 이미 아래로 내려갔으면 취소
      if (dy <= 0 || window.scrollY > 0) {
        active.current = false;
        apply(0);
        return;
      }
      // 아래로 당기는 중엔 페이지 고무줄 막고 우리 인디케이터로 대체
      if (e.cancelable) e.preventDefault();
      apply(Math.min(MAX, dy * 0.5));
    };

    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        window.location.reload();
      } else {
        apply(0);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [refreshing]);

  const visible = pull > 0 || refreshing;
  const ready = pull >= THRESHOLD;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{
        transform: `translateY(${refreshing ? 24 : pull}px)`,
        opacity: visible ? 1 : 0,
        transition: active.current ? "none" : "transform 0.25s, opacity 0.25s",
      }}
    >
      <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 backdrop-blur-md">
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 text-white ${refreshing ? "animate-spin" : ""}`}
          style={{ transform: refreshing ? undefined : `rotate(${Math.min(180, (pull / THRESHOLD) * 180)}deg)` }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {refreshing ? (
            // 스피너(원호)
            <path d="M21 12a9 9 0 1 1-6.2-8.6" />
          ) : ready ? (
            // 놓으면 새로고침 — 위 화살표
            <path d="M12 19V5M5 12l7-7 7 7" />
          ) : (
            // 당기는 중 — 아래 화살표
            <path d="M12 5v14M5 12l7 7 7-7" />
          )}
        </svg>
      </div>
    </div>
  );
}
