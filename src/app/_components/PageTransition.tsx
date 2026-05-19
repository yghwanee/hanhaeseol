"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** 페이지 라우팅 시 위에서 살짝 떨어지듯 들어오는 enter 애니메이션.
 *  pathname 을 key 로 쓰면 라우트 바뀔 때 wrapper 가 remount 되어
 *  globals.css 의 .page-enter-anim 키프레임이 매번 처음부터 재생됨.
 *  Next.js App Router 는 leave 애니메이션을 자연스럽게 지원하지 않아
 *  enter 만 적용 (designus.design 패턴 참고). */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter-anim">
      {children}
    </div>
  );
}
