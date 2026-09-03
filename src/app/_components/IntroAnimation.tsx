"use client";

import { useEffect, useState } from "react";
import {
  INTRO_COL_A as COL_A,
  INTRO_COL_B as COL_B,
  INTRO_COL_C as COL_C,
  INTRO_EMBLEM_PATHS,
} from "./intro-emblems";

const STORAGE_KEY = "haeseol-intro-seen";
const DOMAIN = "haeseol.com";
const SUBTITLE = "한국어 중계 편성표";

/** 인트로 종료 시점을 다른 컴포넌트(`SideBanners`)에게 알림.
 *  사이드 배너가 인트로 fadeout 중 z-index 차이로 비치는 것을 방지하기 위해
 *  이 이벤트를 듣고 그때부터 배너를 렌더한다.
 *
 *  글로벌 플래그도 같이 노출 — race-safe 체크 용. React effect 실행 순서가
 *  children 부터라(IntroAnimation 이 page tree 안에 있어 더 깊고
 *  SideBanners 가 layout body 직속이라 더 얕음), IntroAnimation 의
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
  running,
}: {
  items: string[];
  direction: "up" | "down";
  durationSec: number;
  running: boolean;
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
          // 로고가 다 준비되기 전엔 0지점에 붙잡아 둔다. 그냥 숨기기만 하면
          // 그 사이 애니메이션이 흘러가 페이드인 순간 이미 중간부터 시작한다.
          animationPlayState: running ? "running" : "paused",
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

/** 3열 티커. 로고 21개가 모두 decode() 된 뒤에 한 번에 나타나고 그때부터 흐른다.
 *
 *  로고는 전부 로컬 WebP(21개 합계 117KB, 개당 5.6KB)라 용량은 병목이 아니지만,
 *  타일이 하나씩 채워지며 뜨는 팝인 때문에 등장 타이밍이 제각각으로 보였다.
 *  움직임 자체는 유지하고 로드만 동기화한다. */
function EmblemTicker() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const show = () => {
      if (!cancelled) setReady(true);
    };
    // 이미지 하나가 느리거나 깨져도 인트로가 통째로 비지 않도록 상한을 둔다.
    const timer = setTimeout(show, 1200);
    Promise.all(
      INTRO_EMBLEM_PATHS.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => img.decode().then(resolve, () => resolve());
            img.onerror = () => resolve();
            img.src = src;
          }),
      ),
    ).then(() => {
      clearTimeout(timer);
      show();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div style={{ perspective: "1000px" }}>
      <div
        className={`flex h-[42vh] gap-3 transition-opacity duration-500 sm:h-[60vh] sm:gap-5 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        style={{ transform: "rotateX(30deg)", transformStyle: "preserve-3d" }}
      >
        <TickerColumn items={COL_A} direction="up" durationSec={22} running={ready} />
        <TickerColumn items={COL_B} direction="down" durationSec={26} running={ready} />
        <TickerColumn items={COL_C} direction="up" durationSec={24} running={ready} />
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

    // 내부 SPA 네비게이션 재진입(또는 dev strict mode 두번째 effect 실행): 첫번째
    // effect 가 시작한 animation 이 그대로 진행 중이므로 mode 를 건드리지 않음.
    // setMode("done") 을 호출하면 dev strict mode 에서 인트로가 즉시 사라져 미리보기 불가.
    // SideBanners 가 mount 시 listener 이미 등록한 상태일 수 있어 done 이벤트는 즉시.
    if (handledInThisSession) {
      markIntroDone();
      return;
    }
    handledInThisSession = true;

    // 당겨서 새로고침 등으로 reload한 경우: 인트로/ripple 스킵 → 바로 콘텐츠.
    if (sessionStorage.getItem("hhs-skip-intro-once") === "1") {
      sessionStorage.removeItem("hhs-skip-intro-once");
      setMode("done");
      markIntroDone();
      return;
    }

    // ↓ 일부러 cleanup 으로 animation 을 취소하지 않음.
    //   React 18 dev strict mode 가 effect 를 두 번 돌리는데, cleanup 에서 timers/cancelled
    //   를 끄면 첫번째 effect 가 시작한 타이핑이 첫 sleep 직후 멈춤 ("h" 에서 정지 버그).
    //   인트로는 세션당 1회만 동작하므로 unmount 시점에 타이머 누락이 큰 문제 X.

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    const hasFlag = sessionStorage.getItem(STORAGE_KEY) === "1";

    if (hasFlag) {
      // 새로고침/세션 내 재진입: ripple 잠깐 보여주고 페이드아웃
      setMode("ripple");
      setTimeout(() => setFadingOut(true), 700);
      setTimeout(() => {
        setMode("done");
        markIntroDone();
      }, 1200);
      return;
    }

    // 첫 진입: 풀 인트로
    setMode("intro");

    async function run() {
      for (let i = 1; i <= DOMAIN.length; i++) {
        setText(DOMAIN.slice(0, i));
        await sleep(70 + Math.random() * 40);
      }
      await sleep(550);

      for (let i = DOMAIN.length - 1; i >= 0; i--) {
        setText(DOMAIN.slice(0, i));
        await sleep(22);
      }
      await sleep(180);

      for (let i = 1; i <= SUBTITLE.length; i++) {
        setText(SUBTITLE.slice(0, i));
        await sleep(85 + Math.random() * 50);
      }
      await sleep(750);

      sessionStorage.setItem(STORAGE_KEY, "1");
      setFadingOut(true);
      await sleep(550);
      setMode("done");
      markIntroDone();
    }

    run();
  }, []);

  if (mode === "done") return null;

  return (
    <div
      data-intro-overlay
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950 transition-opacity duration-500 ${
        fadingOut ? "opacity-0" : "opacity-100"
      } ${fadingOut || mode !== "intro" ? "pointer-events-none" : ""}`}
      // 치수를 인라인으로도 박는다 — 스타일시트가 유실돼도(에셋 스큐로 CSS 404)
      // 오버레이가 static 으로 풀려 화면 아래로 밀리지 않게. 클래스와 같은 값이라
      // 정상 로드 시 동작 변화 없음.
      style={{ backgroundColor: "#0a0a0a", position: "fixed", inset: 0, zIndex: 100 }}
      aria-hidden
    >
      {mode === "intro" && (
        <>
          <div
            className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-5xl"
            /* 인트로 타이틀은 "한해설" — 한글이다. Geist 로 두면 글리프가 없어
               시스템 폰트로 떨어져 본문과 다른 폰트로 보인다(2026-09-03). */
            style={{
              fontFamily:
                'var(--font-pretendard-ui), "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif',
            }}
          >
            <span>{text}</span>
            <span className="ml-1 inline-block h-[0.95em] w-[2px] translate-y-[0.08em] bg-red-500 align-middle motion-safe:animate-[introBlink_1s_steps(2,end)_infinite]" />
          </div>

          <div className="mt-10 sm:mt-14">
            <EmblemTicker />
          </div>
        </>
      )}

      {mode === "ripple" && <RippleLoader />}
    </div>
  );
}
