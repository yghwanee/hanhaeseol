"use client";

import { ReactNode, useEffect, useState } from "react";

export function StickyHeader({
  children,
  fullBleedXl = false,
}: {
  children: ReactNode;
  fullBleedXl?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`sticky top-0 z-40 -mx-3 sm:-mx-4 ${fullBleedXl ? "xl:-mx-[200px]" : ""}`}
    >
      {/* 블러 + 그라디언트 배경 (하단 fade) */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-[calc(100%+1.5rem)] transition-opacity duration-300 ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
        style={{
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          backgroundImage:
            "linear-gradient(to bottom, rgba(9,9,11,0.78) 0%, rgba(9,9,11,0.65) 55%, rgba(9,9,11,0) 100%)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
        }}
      />
      <div className="relative mx-auto max-w-2xl px-3 sm:px-4 py-3 sm:py-4">
        {children}
      </div>
    </div>
  );
}
