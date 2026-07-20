import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllGuideSlugs, getGuide } from "@/lib/guides";
import { GuideHeader } from "../_components/GuideHeader";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

// 가이드는 파일로 관리하는 고정 집합 → 알 수 없는 슬러그는 404.
export const dynamicParams = false;

function toIso(date: string, fallback: string): string {
  const d = date || fallback;
  return `${d}T09:00:00+09:00`;
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const guide = getGuide(params.slug);
  if (!guide) return { title: "가이드 - 한해설" };

  const url = `https://haeseol.com/guide/${guide.slug}`;
  const title = `${guide.title} | 한해설`;

  return {
    title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url,
      siteName: "한해설",
      locale: "ko_KR",
      type: "article",
      // images를 여기 두지 않는다. opengraph-image.tsx(파일 컨벤션)가 글마다 다른
      // 카드를 만들어 주입한다. 고정 og-default를 함께 두면 그게 우선한다.
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
    },
  };
}

export default function GuidePage({ params }: { params: Params }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const url = `https://haeseol.com/guide/${guide.slug}`;
  const published = toIso(guide.date, guide.date);
  const modified = toIso(guide.updated ?? guide.date, guide.date);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: guide.title,
        description: guide.description,
        inLanguage: "ko",
        datePublished: published,
        dateModified: modified,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        image: "https://haeseol.com/og-default.png",
        ...(guide.keywords ? { keywords: guide.keywords.join(", ") } : {}),
        author: {
          "@type": "Organization",
          name: "한해설",
          url: "https://haeseol.com",
        },
        publisher: {
          "@type": "Organization",
          name: "한해설",
          logo: {
            "@type": "ImageObject",
            url: "https://haeseol.com/icon.png",
          },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "한해설", item: "https://haeseol.com" },
          { "@type": "ListItem", position: 2, name: "한해설 Topic", item: "https://haeseol.com/guide" },
          { "@type": "ListItem", position: 3, name: guide.title, item: url },
        ],
      },
    ],
  };

  const dateLabel = guide.date.replace(/-/g, ".");
  const updatedLabel = guide.updated ? guide.updated.replace(/-/g, ".") : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <GuideHeader />

      <article className="mt-8">
        <header className="border-b border-zinc-800 pb-6">
          {guide.category ? (
            <span className="inline-block rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
              {guide.category}
            </span>
          ) : null}
          <h1 className="mt-3 text-2xl font-bold leading-snug text-white sm:text-3xl">
            {guide.title}
          </h1>
          <p className="mt-3 text-xs text-zinc-500">
            {dateLabel}
            {updatedLabel && updatedLabel !== dateLabel
              ? ` · ${updatedLabel} 업데이트`
              : ""}
          </p>
        </header>

        <div
          className="prose prose-invert prose-zinc mt-8 max-w-none prose-headings:text-white prose-a:text-sky-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-table:text-sm"
          dangerouslySetInnerHTML={{ __html: guide.bodyHtml }}
        />
      </article>

      <div className="mt-12 border-t border-zinc-800 pt-6 text-sm">
        <Link href="/guide" className="text-sky-400 hover:underline">
          ← 다른 글 더 보기
        </Link>
      </div>
    </main>
  );
}
