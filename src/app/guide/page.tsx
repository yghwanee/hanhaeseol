import type { Metadata } from "next";
import Link from "next/link";
import { getAllGuides } from "@/lib/guides";
import { GuideHeader } from "./_components/GuideHeader";

export const metadata: Metadata = {
  title: "스포츠 중계 가이드 - 어디서 한국어로 보나 | 한해설",
  description:
    "월드컵·EPL·KBO 등 주요 경기를 어디서 한국어 해설로 보는지, 경우의 수와 일정까지 한해설이 직접 정리한 가이드 모음.",
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
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <GuideHeader />

      <header className="mt-8 border-b border-zinc-800 pb-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">한해설 Topic</h1>
        <p className="mt-2 text-sm text-zinc-400">
          주요 경기를 어디서 한국어로 보는지, 일정과 경우의 수까지 직접 정리합니다.
        </p>
      </header>

      {guides.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">아직 등록된 글이 없습니다.</p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-800">
          {guides.map((g) => (
            <li key={g.slug} className="py-5">
              <Link href={`/guide/${g.slug}`} className="group block">
                <div className="flex items-center gap-2">
                  {g.category ? (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                      {g.category}
                    </span>
                  ) : null}
                  <span className="text-xs text-zinc-500">
                    {g.date.replace(/-/g, ".")}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-white group-hover:text-sky-400">
                  {g.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
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
