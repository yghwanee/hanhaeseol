"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "haeseol-intro-seen";
const DOMAIN = "haeseol.com";
const SUBTITLE = "한국어 중계 편성표";

export function IntroAnimation() {
  const [visible, setVisible] = useState(true);
  const [text, setText] = useState("");
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setVisible(false);
      return;
    }

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
        await sleep(35);
      }
      await sleep(180);
      if (cancelled) return;

      for (let i = 1; i <= SUBTITLE.length; i++) {
        if (cancelled) return;
        setText(SUBTITLE.slice(0, i));
        await sleep(85 + Math.random() * 50);
      }

      sessionStorage.setItem(STORAGE_KEY, "1");
      setFadingOut(true);
      await sleep(550);
      if (cancelled) return;
      setVisible(false);
    }

    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950 transition-opacity duration-500 ${
        fadingOut ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden
    >
      <div
        className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-5xl"
        style={{ fontFamily: '"Pretendard Variable", Pretendard, system-ui, sans-serif' }}
      >
        <span>{text}</span>
        <span className="ml-1 inline-block h-[0.95em] w-[2px] translate-y-[0.08em] bg-red-500 align-middle motion-safe:animate-[introBlink_1s_steps(2,end)_infinite]" />
      </div>
    </div>
  );
}
