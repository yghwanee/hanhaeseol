import type { Metadata } from "next";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { AnalysisData } from "@/types/analysis";

export const metadata: Metadata = {
  title: "해외 픽스터 분석글 - 한해설",
  description: "해외 스포츠 픽스터들의 경기 분석글을 번역하여 제공합니다.",
};

function loadAnalysisData(): AnalysisData {
  try {
    const filePath = path.join(process.cwd(), "src/data/analysis.json");
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return { lastUpdated: "", articles: [] };
  }
}

export default function AnalysisPage() {
  const data = loadAnalysisData();
  const articles = data.articles;

  // 날짜별 그룹핑
  const byDate = articles.reduce<Record<string, typeof articles>>((acc, a) => {
    if (!acc[a.date]) acc[a.date] = [];
    acc[a.date].push(a);
    return acc;
  }, {});

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <main className="min-h-screen text-gray-100">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <Link href="/" className="text-blue-400 hover:underline text-sm mb-6 inline-block">
          ← 편성표로 돌아가기
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mb-2">해외 픽스터 분석글</h1>
        <p className="text-zinc-500 text-xs sm:text-sm mb-8">
          해외 스포츠 분석가들의 경기 분석을 번역하여 제공합니다.
          <span className="hidden sm:inline"> 한국어 해설이 제공되는 경기만 포함됩니다.</span>
        </p>

        {articles.length === 0 ? (
          <p className="text-zinc-500 text-sm">아직 등록된 분석글이 없습니다.</p>
        ) : (
          sortedDates.map((date) => {
            const dateObj = new Date(date + "T00:00:00");
            const dateLabel = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${["일", "월", "화", "수", "목", "금", "토"][dateObj.getDay()]})`;

            return (
              <div key={date} className="mb-8">
                <h2 className="text-sm font-semibold text-zinc-400 mb-3 border-b border-zinc-800 pb-2">
                  {dateLabel}
                </h2>
                <div className="space-y-3">
                  {byDate[date].map((article) => (
                    <Link
                      key={article.id}
                      href={`/analysis/${article.id}`}
                      className="block rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-600 hover:bg-zinc-900 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
                          {article.league}
                        </span>
                      </div>
                      <p className="text-sm sm:text-base font-medium text-zinc-100">
                        {article.homeTeam} vs {article.awayTeam}
                      </p>
                      {article.prediction && (
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
                          {article.prediction}
                        </p>
                      )}
                      <p className="text-[10px] text-zinc-600 mt-2">
                        출처: freesupertips.com
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {data.lastUpdated && (
          <p className="text-[10px] text-zinc-600 mt-8 text-center">
            마지막 업데이트: {new Date(data.lastUpdated).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
          </p>
        )}
      </div>
    </main>
  );
}
