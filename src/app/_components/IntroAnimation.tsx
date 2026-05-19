"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "haeseol-intro-seen";
const DOMAIN = "haeseol.com";
const SUBTITLE = "한국어 중계 편성표";

// 로컬 EPL 로고 (naver CDN은 referer hot-link 차단으로 깨질 수 있음) + 로컬 KBO 로고
const COL_A = [
  "/logos/naver-football/1006.png",
  "/logos/kbo/HT.png",
  "/logos/naver-football/12.png",
  "/logos/kbo/LG.png",
  "/logos/naver-football/9.png",
  "/logos/kbo/SS.png",
  "/logos/naver-football/4.png",
];

const COL_B = [
  "/logos/naver-football/11.png",
  "/logos/kbo/KT.png",
  "/logos/naver-football/2.png",
  "/logos/kbo/NC.png",
  "/logos/naver-football/31.png",
  "/logos/kbo/LT.png",
  "/logos/naver-football/8.png",
];

const COL_C = [
  "/logos/naver-football/23.png",
  "/logos/kbo/SK.png",
  "/logos/naver-football/48.png",
  "/logos/kbo/HH.png",
  "/logos/naver-football/6795.png",
  "/logos/kbo/OB.png",
  "/logos/kbo/WO.png",
];

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

type Mode = "loading" | "intro" | "ripple" | "done";

/** 같은 SPA 세션(F5 없는 동안) 안에서 인트로/ripple은 한 번만 노출.
 *  내부 네비게이션으로 메인 페이지에 재진입할 때마다 ripple이 뜨는 걸 방지. */
let handledInThisSession = false;

export function IntroAnimation() {
  const [mode, setMode] = useState<Mode>("loading");
  const [text, setText] = useState("");
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 내부 네비게이션 재진입: 인트로/ripple 전부 스킵
    if (handledInThisSession) {
      setMode("done");
      return;
    }
    handledInThisSession = true;

    const hasFlag = sessionStorage.getItem(STORAGE_KEY) === "1";

    if (hasFlag) {
      // 새로고침/세션 내 재진입: ripple 잠깐 보여주고 페이드아웃
      setMode("ripple");
      const t1 = setTimeout(() => setFadingOut(true), 700);
      const t2 = setTimeout(() => setMode("done"), 1200);
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
