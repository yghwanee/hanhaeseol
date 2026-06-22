import Image from "next/image";
import Link from "next/link";
import { StickyHeader } from "./StickyHeader";

/**
 * 서브페이지 공용 상단 헤더 — 로고(홈 링크) + "← 편성표" 버튼.
 * StickyHeader 래퍼 포함. (메인 페이지/가이드는 자체 헤더 사용)
 */
export function SiteHeader() {
  return (
    <StickyHeader>
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-end">
          <Image src="/icon.png" alt="한해설 아이콘" width={32} height={32} className="h-6 w-6 sm:h-8 sm:w-8 self-center" />
          <span className="ml-1 sm:ml-2 text-xl sm:text-3xl font-bold text-white">한해설</span>
        </Link>
        <Link href="/" className="btn-caps-stripe inline-flex items-center justify-center whitespace-nowrap px-4 py-1.5 text-[11px] font-medium sm:px-5 sm:py-2 sm:text-xs">
          ← &ensp;편성표
        </Link>
      </header>
    </StickyHeader>
  );
}
