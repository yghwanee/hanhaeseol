import Link from "next/link";
import { AG_SPORTS } from "@/lib/asian-games/data";

/** 종목 전환 칩 — 허브와 종목 페이지가 서로를 링크하는 유일한 길이다(사이트맵 밖 고아 방지). */
export function SportNav({ current }: { current?: string }) {
  return (
    <nav aria-label="아시안게임 종목별 일정" className="mb-6 flex flex-wrap gap-2">
      {AG_SPORTS.map((s) => {
        const active = s.slug === current;
        return (
          <Link
            key={s.slug}
            href={`/asian-games/${s.slug}`}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-full border px-3.5 text-label1 ${
              active ? "border-fg-strong bg-fg-strong font-semibold text-canvas" : "border-line text-fg hover:bg-muted"
            }`}
          >
            {s.alias ? `${s.name}(${s.alias})` : s.name} 일정
          </Link>
        );
      })}
    </nav>
  );
}
