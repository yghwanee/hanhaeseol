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
      <div
        className={`border-b transition-[background-color,backdrop-filter,border-color] duration-200 ${
          scrolled
            ? "bg-zinc-950/75 backdrop-blur-md border-zinc-800/60"
            : "bg-transparent border-transparent"
        }`}
      >
        <div className="mx-auto max-w-2xl px-3 sm:px-4 py-3 sm:py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
