import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { AnalysisData } from "@/types/analysis";
import { getTeamLogo } from "@/data/team-logos";
import { TeamLogo } from "./TeamLogo";

const LEAGUE_FLAG: Record<string, string> = {
  "프리미어리그": "GB",
  "EFL 챔피언십": "GB",
  "라리가": "ES",
  "세리에A": "IT",
  "분데스리가": "DE",
  "리그1": "FR",
  "리그 1": "FR",
  "챔피언스리그": "EU",
  "유로파리그": "EU",
  "컨퍼런스리그": "EU",
  "K리그": "KR",
  "K리그1": "KR",
  "K리그2": "KR",
  "NBA": "US",
  "MLB": "US",
  "MLS": "US",
};

function FlagIcon({ code }: { code: string }) {
  const src = `https://flagcdn.com/16x12/${code.toLowerCase()}.png`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={code} width={16} height={12} className="inline-block" />;
}

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
        <Link href="/analysis" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 mb-6 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors">
          ← 분석글 목록
        </Link>

        {/* 경기 헤더 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
              {LEAGUE_FLAG[article.league] && <span className="mr-1.5 align-middle"><FlagIcon code={LEAGUE_FLAG[article.league]} /></span>}{article.league}
            </span>
            <span className="text-xs text-zinc-600">{dateLabel}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {article.homeTeam} vs {article.awayTeam}
          </h1>
          {article.homeTeamEn && article.awayTeamEn && (
            <p className="text-xs text-zinc-600 mt-1">
              {article.homeTeamEn} vs {article.awayTeamEn}
            </p>
          )}

          {/* 팀 앰블럼 */}
          <div className="mt-5 flex items-center justify-center gap-4 sm:gap-8 py-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <TeamLogo name={article.homeTeam} src={getTeamLogo(article.homeTeam)} size={64} />
              <span className="text-xs sm:text-sm font-medium text-zinc-200 text-center truncate max-w-full">
                {article.homeTeam}
              </span>
            </div>
            <span className="text-zinc-500 text-sm font-semibold shrink-0">VS</span>
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <TeamLogo name={article.awayTeam} src={getTeamLogo(article.awayTeam)} size={64} />
              <span className="text-xs sm:text-sm font-medium text-zinc-200 text-center truncate max-w-full">
                {article.awayTeam}
              </span>
            </div>
          </div>
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
            원문 보기 ({new URL(article.sourceUrl).hostname}) →
          </a>
          <p className="text-[10px] text-zinc-600">
            {new Date(article.crawledAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
          </p>
        </div>
      </div>
    </main>
  );
}
