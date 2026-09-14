"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * 상단 내비게이션 — 원티드(몽타주) `header` 규격.
 *
 *   height 60 · bg surface · border-bottom 1px border-subtle · sticky · z 50
 *   inner: max-width 1100 · padding 0 24 · gap 28
 *
 * 🔴 종전 한해설 헤더는 **큰 로고 + 버튼 두 개**였다. 그래서 화면 맨 위가 "제목"처럼
 * 읽혔고, 페이지를 옮겨 다닐 길이 없었다. 원티드 헤더는 반대다 — 로고는 작게 고정하고
 * **nav link 로 사이트 전체 구조를 드러낸다.** active 는 색이 아니라
 * `fg-strong + 하단 2px underline` 으로 표시한다(nav-link 규격).
 *
 * 🔴 그림자를 쓰지 않는다. 헤더는 1px 헤어라인으로 본문과 분리된다 —
 * 그림자는 popover·모달 같은 떠 있는 표면 전용이라는 게 이 시스템의 규칙이다.
 */
const NAV = [
  { href: "/", label: "편성표" },
  { href: "/standings", label: "순위" },
  { href: "/guide", label: "토픽" },
  // "해설 통계"(/commentary)는 헤더에서 뺐다(2026-09-14 화니 지시). 페이지는 살아 있고
  // 홈 편성표 아래 문맥 링크가 그리로 간다.
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-50 border-b border-line-subtle bg-surface">
      <div className="mx-auto flex h-[60px] max-w-[1100px] items-center gap-5 px-5 sm:gap-7 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-1.5" aria-label="한해설 홈">
          <Image src="/icon.png" alt="" width={28} height={28} className="h-6 w-6 sm:h-7 sm:w-7" />
          <span className="text-headline1 font-bold tracking-[-0.02em] text-fg-strong">한해설</span>
        </Link>

        {/* 로고 왼쪽 · 링크 오른쪽 정렬(2026-09-14). justify-end 가 아니라 ml-auto 다 —
            overflow-x-auto 와 justify-end 를 같이 쓰면 넘친 앞쪽이 스크롤로도 안 닿는다. */}
        <nav className="ml-auto flex min-w-0 items-center gap-4 overflow-x-auto scrollbar-hide sm:gap-6">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative -mx-2 whitespace-nowrap px-2 py-[18px] text-label1 font-semibold tracking-[-0.01em] transition-colors ${
                  active ? "text-fg-strong" : "text-fg-secondary hover:text-fg"
                }`}
              >
                {item.label}
                {/* active underline — 색이 아니라 선으로 현재 위치를 말한다 */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-fg-strong"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
