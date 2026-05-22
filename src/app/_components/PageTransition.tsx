"use client";

import { ReactNode, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** 페이지 라우팅 시 위에서 살짝 떨어지듯 들어오는 enter 애니메이션.
 *  wrapper 를 key={pathname} 으로 remount 시키면 페이지 전환 시 DOM 이
 *  한 번 통째로 사라졌다 다시 생겨 첫 paint 까지 체감 지연이 생긴다.
 *  대신 ref 를 유지한 채 pathname 변경 시 className 을 toggle 해서
 *  CSS keyframe 만 재시작. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.classList.remove("page-enter-anim");
    // 강제 reflow 로 animation 재시작
    void el.offsetWidth;
    el.classList.add("page-enter-anim");
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter-anim">
      {children}
    </div>
  );
}
