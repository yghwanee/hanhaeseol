import Link from "next/link";
import type { Guide } from "@/lib/guides";

/**
 * 가이드(한해설 Topic) 글 카드 묶음. 메인·월드컵·리그 등에서 관련 글로 내부 링크하는 용도.
 * 내부 링크가 늘면 가이드 페이지 크롤 빈도·체류·도메인 권위가 올라간다(SEO).
 */
export function GuideCards({ title, guides }: { title: string; guides: Guide[] }) {
  if (guides.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold text-zinc-100 sm:text-lg">{title}</h2>
        <Link href="/guide" className="text-xs text-zinc-400 hover:text-white">
          전체 보기 →
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/guide/${g.slug}`}
              className="group block h-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
            >
              <div className="flex items-center gap-2">
                {g.category ? (
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                    {g.category}
                  </span>
                ) : null}
                <span className="text-[10px] text-zinc-500">
                  {g.date.replace(/-/g, ".")}
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-semibold leading-snug text-zinc-100 group-hover:text-sky-400">
                {g.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                {g.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
