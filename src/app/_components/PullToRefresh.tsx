"use client";

import { useEffect, useRef, useState } from "react";

// 배민 스타일 당겨서 새로고침(pull-to-refresh).
// 설치형(standalone)에서만 — 일반 브라우저는 자체 당겨서 새로고침이 있어 충돌 방지.
// 맨 위(scrollY=0)에서 아래로 끌면 영역이 늘어나며 스포츠 공들이 '팡' 나타나고
// "땡겨서 스포츠경기 리프레시" 문구 표시. 임계값 넘겨 놓으면 reload.
const THRESHOLD = 80; // 이만큼 당기면 새로고침(공 팡 터짐)
const MAX = 130; // 최대 당김(고무줄 저항)

const BALLS = [
  { e: "🎾", x: "50%", y: "20%", d: 0 },
  { e: "🏀", x: "27%", y: "37%", d: 70 },
  { e: "⚾", x: "73%", y: "37%", d: 110 },
  { e: "⚽", x: "13%", y: "64%", d: 160 },
  { e: "🏐", x: "87%", y: "64%", d: 210 },
];

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
      if (dy <= 0 || window.scrollY > 0) {
        active.current = false;
        apply(0);
        return;
      }
      // 아래로 당기는 중엔 페이지 고무줄 막고 우리 영역으로 대체
      if (e.cancelable) e.preventDefault();
      apply(Math.min(MAX, dy * 0.55));
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
  const ready = pull >= THRESHOLD || refreshing;
  const p = Math.min(1, pull / THRESHOLD);
  const height = refreshing ? 96 : pull;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] overflow-hidden"
      style={{
        height,
        opacity: visible ? 1 : 0,
        transition: active.current ? "none" : "height 0.25s ease, opacity 0.25s ease",
        background:
          "linear-gradient(180deg, #0a0a0a 0%, rgba(10,10,10,0.92) 75%, rgba(10,10,10,0.7) 100%)",
      }}
    >
      <div className="relative h-full w-full">
        {BALLS.map((b, i) => (
          <span
            key={i}
            style={{ position: "absolute", left: b.x, top: b.y, transform: "translate(-50%,-50%)" }}
          >
            <span
              className={ready ? "animate-[ballPop_0.55s_ease-out_backwards]" : ""}
              style={{
                display: "inline-block",
                fontSize: 30,
                transform: ready ? "scale(1)" : `scale(${p})`,
                opacity: ready ? 1 : p * p,
                animationDelay: ready ? `${b.d}ms` : undefined,
              }}
            >
              {b.e}
            </span>
          </span>
        ))}
        <div
          className="absolute inset-x-0 bottom-2 text-center text-sm font-extrabold tracking-tight"
          style={{ opacity: Math.min(1, p * 1.25) }}
        >
          {refreshing ? (
            <span className="text-white">새로고침 중…</span>
          ) : (
            <span className="text-white">
              땡겨서 <span className="text-emerald-400">스포츠경기</span> 리프레시
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
