"use client";

import { useEffect, useRef, useState } from "react";

// 배민 스타일 당겨서 새로고침(pull-to-refresh). 설치형(standalone)에서만.
// - 맨 위에서 당기면 본문(.ptr-content)이 같이 내려가고 위에 드러난 영역에
//   스포츠 공이 '팡' + "땡겨서 스포츠경기 리프레시".
// - 계속 잡고 당기면 고무줄처럼 계속 늘어남(저항 증가, 화면 ~42%까지).
// - 임계점 넘는 순간 햅틱(진동) 1회.
// - 놓으면 로딩/인트로 없이 즉시 새로고침(reload 전 인트로 스킵 플래그 + 영역 즉시 숨김).
const THRESHOLD = 80; // 이만큼(저항 적용 후) 당기면 새로고침
const SKIP_INTRO_KEY = "hhs-skip-intro-once";

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
  const wasReady = useRef(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const hapticRef = useRef<HTMLInputElement>(null);

  const setVar = (v: number) => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--ptr", v + "px");
  };
  const apply = (v: number) => {
    pullRef.current = v;
    setPull(v);
    setVar(v);
  };

  // 햅틱: 안드로이드=Vibration API, iOS=숨긴 switch 토글 트릭(iOS 17.4+).
  const haptic = () => {
    try {
      (navigator as unknown as { vibrate?: (n: number) => void }).vibrate?.(12);
    } catch {
      /* noop */
    }
    try {
      hapticRef.current?.click();
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

    // iOS 햅틱 트릭용 switch 속성(React가 모르는 속성이라 직접 set)
    hapticRef.current?.setAttribute("switch", "");

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
      // 임계점 넘는 순간 햅틱 1회
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
        // 이 reload에선 인트로/ripple 스킵 → 바로 콘텐츠 갱신처럼 보이게.
        try {
          sessionStorage.setItem(SKIP_INTRO_KEY, "1");
        } catch {
          /* noop */
        }
        // reload는 새 페이지 뜰 때까지 현 화면을 멈춰 보여줘 잔상 생김 → 즉시 숨김.
        if (zoneRef.current) zoneRef.current.style.opacity = "0";
        root.classList.remove("ptr-pulling");
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
    <>
      {/* iOS 햅틱용 숨긴 switch (off-screen). display:none이면 햅틱 안 와서 화면 밖으로. */}
      <label aria-hidden style={{ position: "fixed", left: "-9999px", top: 0, pointerEvents: "none" }}>
        <input ref={hapticRef} type="checkbox" tabIndex={-1} />
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
    </>
  );
}
