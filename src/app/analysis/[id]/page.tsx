import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { AnalysisData } from "@/types/analysis";

function loadAnalysisData(): AnalysisData {
  try {
    const filePath = path.join(process.cwd(), "src/data/analysis.json");
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return { lastUpdated: "", articles: [] };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = loadAnalysisData();
  const article = data.articles.find((a) => a.id === id);

  if (!article) return { title: "분석글을 찾을 수 없습니다 - 한해설" };

  return {
    title: `${article.homeTeam} vs ${article.awayTeam} 경기 분석 - 한해설`,
    description: `${article.league} ${article.homeTeam} vs ${article.awayTeam} 해외 픽스터 분석글`,
  };
}

export default async function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = loadAnalysisData();
  const article = data.articles.find((a) => a.id === id);

  if (!article) notFound();

  const dateObj = new Date(article.date + "T00:00:00");
  const dateLabel = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;

  return (
    <main className="min-h-screen text-gray-100">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <Link href="/analysis" className="text-blue-400 hover:underline text-sm mb-6 inline-block">
          ← 분석글 목록
        </Link>

        {/* 경기 헤더 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
              {article.league}
            </span>
            <span className="text-xs text-zinc-600">{dateLabel}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {article.homeTeam} vs {article.awayTeam}
          </h1>
          <p className="text-xs text-zinc-600 mt-1">
            {article.homeTeamEn} vs {article.awayTeamEn}
          </p>
        </div>

        {/* 예측 */}
        {article.prediction && (
          <div className="mb-6 p-3 sm:p-4 rounded-lg bg-zinc-900 border border-zinc-800">
            <h2 className="text-xs font-semibold text-zinc-400 mb-2">예측</h2>
            <p className="text-sm text-zinc-200 whitespace-pre-line">{article.prediction}</p>
          </div>
        )}

        {/* 분석 본문 */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-400">분석</h2>
          {article.content.split("\n\n").map((paragraph, i) => (
            <p key={i} className="text-sm sm:text-[15px] leading-relaxed text-zinc-300">
              {paragraph}
            </p>
          ))}
        </div>

        {/* 출처 */}
        <div className="mt-8 pt-4 border-t border-zinc-800 flex items-center justify-between">
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            원문 보기 (freesupertips.com) →
          </a>
          <p className="text-[10px] text-zinc-600">
            {new Date(article.crawledAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
          </p>
        </div>
      </div>
    </main>
  );
}
