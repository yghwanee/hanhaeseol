"use client";

import { useEffect, useState } from "react";
import { INTRO_COL_A as COL_A, INTRO_COL_B as COL_B, INTRO_COL_C as COL_C } from "./intro-emblems";

const STORAGE_KEY = "haeseol-intro-seen";
const DOMAIN = "haeseol.com";
const SUBTITLE = "한국어 중계 편성표";

/** 인트로 종료 시점을 다른 컴포넌트(예: CoupangSideBanners)에게 알림.
 *  사이드 배너의 AdSkeleton 이 인트로 fadeout 중 z-index 차이로 비치는 것을
 *  방지하기 위해 이 이벤트를 듣고 그때부터 배너 렌더링.
 *
 *  글로벌 플래그도 같이 노출 — race-safe 체크 용. React effect 실행 순서가
 *  children 부터라(IntroAnimation 이 page tree 안에 있어 더 깊고
 *  CoupangSideBanners 가 layout body 직속이라 더 얕음), IntroAnimation 의
 *  useEffect 가 먼저 실행되어 동기 dispatch 가 listener 등록보다 빠를 수
 *  있음. CoupangBanners 가 mount 시 isIntroDone() 으로 직접 확인 가능. */
export const INTRO_DONE_EVENT = "haeseol:intro-done";
let introDoneFlag = false;
export function isIntroDone(): boolean {
  return introDoneFlag;
}
function markIntroDone() {
  introDoneFlag = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(INTRO_DONE_EVENT));
  }
}

function TickerColumn({
  items,
  direction,
  durationSec,
}: {
  items: string[];
  direction: "up" | "down";
  durationSec: number;
}) {
  const doubled = [...items, ...items];
  const maskGradient =
    "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgb(0,0,0) 20%, rgb(0,0,0) 80%, rgba(0,0,0,0) 100%)";
  return (
    <div
      className="h-full overflow-hidden"
      style={{ maskImage: maskGradient, WebkitMaskImage: maskGradient }}
    >
      <div
        className="flex flex-col gap-3 sm:gap-4"
        style={{
          animation: `tickerScroll${direction === "up" ? "Up" : "Down"} ${durationSec}s linear infinite`,
          willChange: "transform",
        }}
      >
        {doubled.map((src, i) => (
          <div
            key={i}
            className="flex aspect-square w-24 shrink-0 items-center justify-center rounded-2xl bg-zinc-900/70 p-3 sm:w-40 sm:p-5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              loading="eager"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.fallback === "1") return;
                img.dataset.fallback = "1";
                img.src = "/icon.png";
              }}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function RippleLoader() {
  return (
    <div className="relative h-24 w-24 sm:h-28 sm:w-28">
      {[0, 0.45, 0.9].map((delay, i) => (
        <span
          key={i}
          className="absolute inset-0 rounded-full border-[4px] border-red-500"
          style={{
            animation: "rippleScale 1.5s linear infinite",
            animationDelay: `${delay}s`,
            opacity: 0,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
}

type Mode = "intro" | "ripple" | "done";

/** 같은 SPA 세션(F5 없는 동안) 안에서 인트로/ripple은 한 번만 노출.
 *  내부 네비게이션으로 메인 페이지에 재진입할 때마다 ripple이 뜨는 걸 방지. */
let handledInThisSession = false;

export function IntroAnimation() {
  // SSR 부터 mode="intro" 로 시작해 초기 HTML 에 인트로 구조(티커/커서)
  // 가 박혀 첫 페인트부터 바로 보임. 내부 SPA 네비 재진입 시에는 lazy
  // initializer 가 handledInThisSession 을 보고 즉시 "done" 으로 시작.
  const [mode, setMode] = useState<Mode>(() => (handledInThisSession ? "done" : "intro"));
  const [text, setText] = useState("");
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 내부 네비게이션 재진입: 이미 done 으로 시작했으므로 done 이벤트만 한 번 더 쏘고 종료.
    // CoupangSideBanners 가 mount 시 listener 이미 등록한 상태일 수 있어 즉시 알림.
    if (handledInThisSession) {
      markIntroDone();
      return;
    }
    handledInThisSession = true;

    const hasFlag = sessionStorage.getItem(STORAGE_KEY) === "1";

    if (hasFlag) {
      // 새로고침/세션 내 재진입: ripple 잠깐 보여주고 페이드아웃
      setMode("ripple");
      const t1 = setTimeout(() => setFadingOut(true), 700);
      const t2 = setTimeout(() => {
        setMode("done");
        markIntroDone();
      }, 1200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    // 첫 진입: 풀 인트로
    setMode("intro");
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(resolve, ms);
        timers.push(id);
      });

    async function run() {
      for (let i = 1; i <= DOMAIN.length; i++) {
        if (cancelled) return;
        setText(DOMAIN.slice(0, i));
        await sleep(70 + Math.random() * 40);
      }
      await sleep(550);
      if (cancelled) return;

      for (let i = DOMAIN.length - 1; i >= 0; i--) {
        if (cancelled) return;
        setText(DOMAIN.slice(0, i));
        await sleep(22);
      }
      await sleep(180);
      if (cancelled) return;

      for (let i = 1; i <= SUBTITLE.length; i++) {
        if (cancelled) return;
        setText(SUBTITLE.slice(0, i));
        await sleep(85 + Math.random() * 50);
      }
      await sleep(750);
      if (cancelled) return;

      sessionStorage.setItem(STORAGE_KEY, "1");
      setFadingOut(true);
      await sleep(550);
      if (cancelled) return;
      setMode("done");
      markIntroDone();
    }

    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  if (mode === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950 transition-opacity duration-500 ${
        fadingOut ? "opacity-0" : "opacity-100"
      } ${fadingOut || mode !== "intro" ? "pointer-events-none" : ""}`}
      aria-hidden
    >
      {mode === "intro" && (
        <>
          <div
            className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-5xl"
            style={{ fontFamily: '"Pretendard Variable", Pretendard, system-ui, sans-serif' }}
          >
            <span>{text}</span>
            <span className="ml-1 inline-block h-[0.95em] w-[2px] translate-y-[0.08em] bg-red-500 align-middle motion-safe:animate-[introBlink_1s_steps(2,end)_infinite]" />
          </div>

          <div className="mt-10 sm:mt-14" style={{ perspective: "1000px" }}>
            <div
              className="flex h-[42vh] gap-3 sm:h-[60vh] sm:gap-5"
              style={{ transform: "rotateX(20deg)", transformStyle: "preserve-3d" }}
            >
              <TickerColumn items={COL_A} direction="up" durationSec={22} />
              <TickerColumn items={COL_B} direction="down" durationSec={26} />
              <TickerColumn items={COL_C} direction="up" durationSec={24} />
            </div>
          </div>
        </>
      )}

      {mode === "ripple" && <RippleLoader />}
    </div>
  );
}
