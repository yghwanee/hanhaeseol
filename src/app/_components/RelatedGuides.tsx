import Link from "next/link";
import { relatedGuides } from "@/lib/guides/related";

/**
 * 허브 페이지 하단 「관련 Topic」 — 최신 글 3편. 맞는 글이 없으면 아무것도 그리지 않는다.
 * 존재 이유는 `src/lib/guides/related.ts` 주석(구글이 토픽 글을 한 번도 안 가져갔다).
 */
export default function RelatedGuides({
  terms,
  className = "",
}: {
  terms: string[];
  className?: string;
}) {
  const guides = relatedGuides(terms);
  if (guides.length === 0) return null;

  return (
    <section className={`rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5 ${className}`}>
      <h2 className="text-label1 font-semibold text-fg-strong sm:text-headline1">관련 Topic</h2>
      <ul className="mt-2 divide-y divide-line-subtle">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={`/guide/${g.slug}`} className="group block py-3">
              <span className="block text-caption1 text-fg-tertiary tabular-nums">
                {g.category ? `${g.category} · ` : ""}
                {g.date.slice(5).replace("-", ".")}
              </span>
              <span className="mt-0.5 block break-keep text-label1 text-fg group-hover:text-fg-strong">
                {g.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-right text-caption1 text-fg-tertiary">
        <Link href="/guide" className="-my-2 inline-block py-2 hover:text-fg">
          Topic 전체 보기 ›
        </Link>
      </p>
    </section>
  );
}
