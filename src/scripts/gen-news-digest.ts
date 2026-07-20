/**
 * 감시 키워드 뉴스를 모아 `docs/news-digest.md`로 떨군다.
 *
 * 주간 글감 루틴(claude.ai)이 이 파일을 읽고 글감을 만든다.
 * 루틴이 직접 웹 검색을 하면 발행일을 모른 채 이미 끝난 이벤트를 글감으로 내는데,
 * 여기서 pubDate로 미리 걸러 **최근 기사만** 넘긴다.
 *
 * 실행: NAVER_API_KEY_ID=... NAVER_API_KEY=... npm run news:digest
 */
import fs from "node:fs";
import path from "node:path";
import {
  WATCH_KEYWORDS,
  searchNews,
  toArticles,
  rankArticles,
  type NewsArticle,
} from "../lib/news/naver-news";

const OUT_PATH = path.join(process.cwd(), "docs", "news-digest.md");
/** 며칠치를 볼지. 주간 루틴이 월요일에 읽으니 한 주를 덮는다. */
const WINDOW_DAYS = 7;
/** 키워드당 몇 건까지 남길지 — 루틴이 읽을 분량이라 너무 많으면 오히려 흐려진다. */
const PER_KEYWORD = 5;
/** 전체 상위 몇 건을 맨 위에 따로 뽑을지 */
const TOP_OVERALL = 15;

function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function renderSection(title: string, articles: NewsArticle[]): string[] {
  if (articles.length === 0) return [];
  const lines = [`### ${title}`, ""];
  for (const a of articles) {
    lines.push(`- **${a.title}** (${a.date}) — [원문](${a.url})`);
    if (a.summary) lines.push(`  - ${a.summary}`);
  }
  lines.push("");
  return lines;
}

async function main() {
  const keyId = process.env.NAVER_API_KEY_ID;
  const key = process.env.NAVER_API_KEY;
  if (!keyId || !key) {
    throw new Error(
      "NAVER_API_KEY_ID / NAVER_API_KEY 가 없습니다. (NAVER Cloud API HUB 검색 API 키)",
    );
  }

  const sinceMs = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const byKeyword: { keyword: string; articles: NewsArticle[] }[] = [];
  const all: NewsArticle[] = [];

  // 키워드 십여 개면 하루 한도(25,000)에 견줘 무시할 양이라 순차로 돈다.
  for (const keyword of WATCH_KEYWORDS) {
    try {
      const items = await searchNews(keyword, { keyId, key, display: 30 });
      const articles = rankArticles(toArticles(keyword, items, sinceMs), PER_KEYWORD);
      byKeyword.push({ keyword, articles });
      all.push(...articles);
      console.log(`  ${keyword}: ${articles.length}건`);
    } catch (err) {
      // 키워드 하나가 실패해도 나머지는 살린다 — 다이제스트가 통째로 날아가는 게 더 나쁘다.
      console.error(`  ${keyword}: 실패 — ${(err as Error).message}`);
      byKeyword.push({ keyword, articles: [] });
    }
  }

  const today = kstNow().toISOString().slice(0, 10);
  // 한 키워드가 상위 목록을 독식하지 못하게 2건까지만
  const top = rankArticles(all, TOP_OVERALL, 2);

  const lines = [
    "# 뉴스 다이제스트 (자동 생성)",
    "",
    `> ${today} KST 기준 · 최근 ${WINDOW_DAYS}일 · 네이버 뉴스 검색 API`,
    "> 이 파일은 `news-digest.yml`이 덮어쓴다. 직접 고치지 말 것.",
    "",
    "주간 글감 루틴은 이 파일을 근거로 글감을 만든다.",
    "**여기 없는 사실은 쓰지 말 것.** 기사 날짜가 이미 지난 이벤트는 글감에서 뺄 것.",
    "",
    "## 🔥 이번 주 상위",
    "",
  ];

  for (const a of top) {
    lines.push(`- **${a.title}** (${a.date}) · \`${a.keyword}\` — [원문](${a.url})`);
  }
  lines.push("", "## 키워드별", "");

  for (const { keyword, articles } of byKeyword) {
    lines.push(...renderSection(keyword, articles));
  }

  if (all.length === 0) {
    lines.push("_수집된 기사가 없습니다. API 키나 한도를 확인하세요._", "");
  }

  fs.writeFileSync(OUT_PATH, lines.join("\n"), "utf8");
  console.log(`\n${OUT_PATH} — 총 ${all.length}건 (상위 ${top.length}건)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
