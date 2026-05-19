"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PRESS_DURATION_MS = 380;

/** 모바일(:hover 없는 기기)에서 .btn-caps-stripe 링크를 탭하면
 *  sweep 효과를 끝까지 재생한 다음 Next 라우터로 이동. */
export function CapsStripeClickHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: hover)").matches) return; // 데스크탑은 그대로 둠

    const onClick = (e: MouseEvent) => {
      // 새 탭/조합키 등은 기본 동작
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest<HTMLAnchorElement>("a.btn-caps-stripe[href]");
      if (!btn) return;
      // 이미 처리 중이면 통과시키지 않음 (재진입 방지)
      if (btn.dataset.capsAnim === "1") {
        e.preventDefault();
        return;
      }
      const href = btn.getAttribute("href");
      if (!href) return;
      // 외부 링크는 그대로 둠
      if (/^https?:\/\//.test(href) && !href.startsWith(window.location.origin)) return;
      if (btn.target === "_blank") return;

      e.preventDefault();
      btn.dataset.capsAnim = "1";
      btn.classList.add("caps-stripe-pressed");
      window.setTimeout(() => {
        router.push(href);
      }, PRESS_DURATION_MS);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
