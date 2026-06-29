"use client";

import { useEffect, useRef, useState } from "react";

// 배민 스타일 당겨서 새로고침(pull-to-refresh).
// 설치형(standalone)에서만 — 일반 브라우저는 자체 당겨서 새로고침이 있어 충돌 방지.
// 맨 위(scrollY=0)에서 아래로 끌면 본문(.ptr-content)이 같이 내려가며 위에 드러난
// 영역에 스포츠 공들이 '팡' 나타나고 "땡겨서 스포츠경기 리프레시" 문구.
// 놓으면 로딩 표시 없이 즉시 영역을 숨기고 바로 reload(잔상 없음).
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
  const pullRef = useRef(0);
  const startY = useRef(0);
  const active = useRef(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  const setVar = (v: number) => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--ptr", v + "px");
  };
  const apply = (v: number) => {
    pullRef.current = v;
    setPull(v);
    setVar(v);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    const root = document.documentElement;

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0) {
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
        root.classList.remove("ptr-pulling");
        root.removeAttribute("data-ptr-active");
        return;
      }
      // 아래로 당기는 중엔 페이지 고무줄 막고 본문을 같이 내림
      if (e.cancelable) e.preventDefault();
      if (clearTimer.current) {
        clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
      root.classList.add("ptr-pulling");
      root.setAttribute("data-ptr-active", ""); // 손가락 추종(전환 없음)
      apply(Math.min(MAX, dy * 0.55));
    };

    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      if (pullRef.current >= THRESHOLD) {
        // 로딩 표시 없이 즉시 새로고침. reload는 새 페이지 뜰 때까지 현 화면을
        // 멈춰 보여주므로, 멈추기 전에 DOM을 직접 즉시 숨겨 공/영역 잔상을 없앤다.
        if (zoneRef.current) zoneRef.current.style.opacity = "0";
        root.classList.remove("ptr-pulling"); // transform 즉시 해제(콘텐츠 원위치)
        root.removeAttribute("data-ptr-active");
        setVar(0);
        window.location.reload();
        return;
      }
      // 임계값 미만 → 부드럽게 스프링백
      root.removeAttribute("data-ptr-active");
      apply(0);
      clearTimer.current = setTimeout(() => root.classList.remove("ptr-pulling"), 360);
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
      if (clearTimer.current) clearTimeout(clearTimer.current);
      root.classList.remove("ptr-pulling");
      root.removeAttribute("data-ptr-active");
      setVar(0);
    };
  }, []);

  const visible = pull > 0;
  const ready = pull >= THRESHOLD;
  const p = Math.min(1, pull / THRESHOLD);

  return (
    <div
      ref={zoneRef}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[40] overflow-hidden"
      style={{
        height: pull,
        opacity: visible ? 1 : 0,
        transition: active.current ? "none" : "height 0.32s cubic-bezier(0.2,0.8,0.2,1), opacity 0.3s ease",
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
          <span className="text-white">
            땡겨서 <span className="text-emerald-400">스포츠경기</span> 리프레시
          </span>
        </div>
      </div>
    </div>
  );
}
