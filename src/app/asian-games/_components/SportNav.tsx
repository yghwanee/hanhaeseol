import Link from "next/link";
import { AG_SPORTS } from "@/lib/asian-games/data";

/** 종목 전환 칩 — 허브와 종목 페이지가 서로를 링크하는 유일한 길이다(사이트맵 밖 고아 방지). */
export function SportNav({ current }: { current?: string }) {
  return (
    <nav aria-label="아시안게임 종목별 일정" className="mb-6 flex flex-wrap gap-2">
      {/* 🔴 「아시안게임 중계」(월 34,710) 착지 페이지로 가는 유일한 길. */}
      <Link
        href="/asian-games/broadcast"
        aria-current={current === "broadcast" ? "page" : undefined}
        className={`inline-flex h-9 items-center rounded-full border px-3.5 text-label1 ${
          current === "broadcast" ? "border-fg-strong bg-fg-strong font-semibold text-canvas" : "border-line text-fg hover:bg-muted"
        }`}
      >
        중계 채널
      </Link>
      {/* 🔴 「아시안게임 롤」 73,200 · 「롤 국가대표」 6,820 · 「아시안게임 페이커」 1,080 의 착지 페이지. */}
      <Link
        href="/asian-games/lol"
        aria-current={current === "lol" ? "page" : undefined}
        className={`inline-flex h-9 items-center rounded-full border px-3.5 text-label1 ${
          current === "lol" ? "border-fg-strong bg-fg-strong font-semibold text-canvas" : "border-line text-fg hover:bg-muted"
        }`}
      >
        롤 일정·국가대표
      </Link>
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
