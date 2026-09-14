import type { Metadata } from "next";
import Link from "next/link";
import { getAllGuides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "스포츠 중계 가이드 - 어디서 한국어로 보나 | 한해설",
  description:
    "EPL·KBO·MLB·월드컵 등 주요 경기를 어디서 한국어 해설로 보는지, 여러 플랫폼에 흩어진 중계 일정에서 챙겨볼 만한 경기를 골라 정리한 한해설 가이드 모음.",
  alternates: { canonical: "https://haeseol.com/guide" },
  openGraph: {
    title: "스포츠 중계 가이드 | 한해설",
    description:
      "월드컵·EPL·KBO 등 주요 경기를 어디서 한국어 해설로 보는지 정리한 가이드 모음.",
    url: "https://haeseol.com/guide",
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "https://haeseol.com/og-default.png", width: 1200, height: 630, alt: "한해설 가이드" }],
  },
};

export default function GuideIndexPage() {
  const guides = getAllGuides();

  return (
    <main className="mx-auto max-w-[1100px] px-5 sm:px-6 py-8 sm:py-12">

      <header className="mt-8 border-b border-line-subtle pb-6">
        <h1 className="text-title3 font-bold text-fg-strong sm:text-title2">한해설 Topic</h1>
        <p className="mt-2 text-label1 text-fg-secondary">
          여러 플랫폼에 흩어진 중계 일정 속에서, 챙겨볼 만한 경기를 골라 정리합니다.
        </p>
      </header>

      {guides.length === 0 ? (
        <p className="mt-8 text-label1 text-fg-tertiary">아직 등록된 글이 없습니다.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line-subtle">
          {guides.map((g) => (
            <li key={g.slug} className="py-5">
              <Link href={`/guide/${g.slug}`} className="group block">
                <div className="flex items-center gap-2">
                  {g.category ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-caption1 font-medium text-fg">
                      {g.category}
                    </span>
                  ) : null}
                  <span className="text-caption1 text-fg-tertiary">
                    {g.date.replace(/-/g, ".")}
                  </span>
                </div>
                <h2 className="mt-2 text-headline1 font-semibold text-fg-strong group-hover:text-fg-brand-bright">
                  {g.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-label1 text-fg-secondary">
                  {g.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
