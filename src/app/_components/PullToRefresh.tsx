"use client";

import { useEffect, useRef, useState } from "react";

// 배민 스타일 당겨서 새로고침(pull-to-refresh). 설치형(standalone)에서만.
// - 맨 위에서 당기면 본문(.ptr-content)이 같이 내려가고 위에 드러난 영역 하단에
//   공+텍스트 한 세트("🎾🏀⚾⚽🏐 / 땡겨서 스포츠경기 리프레시")가 같이 표시.
// - 계속 잡고 당기면 고무줄처럼 계속 늘어남(공/텍스트는 한 묶음이라 안 벌어짐).
// - 임계점 넘는 순간 햅틱 1회. 놓으면 로딩/인트로 없이 즉시 새로고침.
const THRESHOLD = 80;
const SKIP_INTRO_KEY = "hhs-skip-intro-once";
const BALLS = ["🎾", "🏀", "⚾", "⚽", "🏐"];

export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const startY = useRef(0);
  const active = useRef(false);
  const wasReady = useRef(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const hapticLabelRef = useRef<HTMLLabelElement>(null);
  const hapticInputRef = useRef<HTMLInputElement>(null);

  const setVar = (v: number) => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--ptr", v + "px");
  };
  const apply = (v: number) => {
    pullRef.current = v;
    setPull(v);
    setVar(v);
  };

  // 햅틱: 안드로이드=Vibration API, iOS=숨긴 switch 토글(label click) 트릭(iOS 17.4+).
  const haptic = () => {
    try {
      (navigator as unknown as { vibrate?: (n: number) => void }).vibrate?.(15);
    } catch {
      /* noop */
    }
    try {
      hapticLabelRef.current?.click();
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    hapticInputRef.current?.setAttribute("switch", ""); // iOS 햅틱 트릭용

    const root = document.documentElement;

    // 고무줄 저항: 손가락 이동(dy)을 점근적으로 변환 → 계속 늘지만 갈수록 저항.
    const resist = (dy: number) => {
      const M = Math.min(window.innerHeight * 0.42, 360);
      return M * (1 - Math.exp(-dy / M));
    };

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0) {
        active.current = false;
        return;
      }
      startY.current = e.touches[0].clientY;
      active.current = true;
      wasReady.current = false;
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
      if (e.cancelable) e.preventDefault();
      if (clearTimer.current) {
        clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
      root.classList.add("ptr-pulling");
      root.setAttribute("data-ptr-active", "");
      const v = resist(dy);
      if (v >= THRESHOLD && !wasReady.current) {
        wasReady.current = true;
        haptic();
      } else if (v < THRESHOLD) {
        wasReady.current = false;
      }
      apply(v);
    };

    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      if (pullRef.current >= THRESHOLD) {
        try {
          sessionStorage.setItem(SKIP_INTRO_KEY, "1");
        } catch {
          /* noop */
        }
        if (zoneRef.current) zoneRef.current.style.opacity = "0";
        root.classList.remove("ptr-pulling");
        root.removeAttribute("data-ptr-active");
        setVar(0);
        window.location.reload();
        return;
      }
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
    <>
      {/* iOS 햅틱용 숨긴 switch (화면 안 1px, 안 보이게). */}
      <label
        ref={hapticLabelRef}
        aria-hidden
        style={{ position: "fixed", right: 0, bottom: 0, width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none", zIndex: -1 }}
      >
        <input ref={hapticInputRef} type="checkbox" tabIndex={-1} />
      </label>

      <div
        ref={zoneRef}
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[40] overflow-hidden"
        style={{
          height: pull,
          opacity: visible ? 1 : 0,
          transition: active.current
            ? "none"
            : "height 0.32s cubic-bezier(0.2,0.8,0.2,1), opacity 0.3s ease",
        }}
      >
        {/* 공+텍스트 한 세트 — 세로 가운데 정렬, 고정 크기. 당기면 위아래만 늘어나고
            세트는 중앙에 유지(안 벌어짐). */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <div className="flex items-center gap-1.5">
            {BALLS.map((e, i) => (
              <span
                key={i}
                className={ready ? "animate-[ballPop_0.5s_ease-out_backwards]" : ""}
                style={{
                  display: "inline-block",
                  fontSize: 26,
                  transform: ready ? "scale(1)" : `scale(${p})`,
                  opacity: ready ? 1 : p * p,
                  animationDelay: ready ? `${i * 55}ms` : undefined,
                }}
              >
                {e}
              </span>
            ))}
          </div>
          <div
            className="text-sm font-extrabold tracking-tight"
            style={{ opacity: Math.min(1, p * 1.25) }}
          >
            <span className="text-white">
              땡겨서 <span className="text-emerald-400">스포츠경기</span> 리프레시
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
