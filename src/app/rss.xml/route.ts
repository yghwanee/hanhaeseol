import { loadScheduleData } from "@/lib/server-data";
import { readInsight } from "@/lib/insights/storage";
import { matchToSlug } from "@/lib/match-slug";
import { getAllGuides, type Guide } from "@/lib/guides";
import type { Schedule } from "@/types/schedule";

const BASE = "https://haeseol.com";
const FEED_TITLE = "한해설 - 한국어 해설 스포츠 중계 편성표";
const FEED_DESC =
  "EPL·KBO·MLB·라리가·UCL 등 한국어 해설 중계 편성과 매치 인사이트. SPOTV NOW·쿠팡플레이·티빙·SPOTV 등 10개 플랫폼.";

/** RSS는 캐시 가능 — 매 hr 정도면 충분. ISR-style revalidate. */
export const revalidate = 1800;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(s: string): string {
  // CDATA 내부에 ']]>' 가 들어가면 닫힘. split-merge 로 회피.
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function rfc822(d: Date): string {
  return d.toUTCString();
}

type FeedItem = {
  matchId: string;
  url: string;
  title: string;
  descriptionHtml: string;
  pubDate: Date;
  /** 정렬용 가중치: 인사이트 있으면 점수↑ (최근 생성된 unique 콘텐츠 우선) */
  weight: number;
};

function startDate(s: Schedule): Date {
  const [hh, mm] = s.time.split(":");
  return new Date(`${s.date}T${hh}:${mm}:00+09:00`);
}

function buildItem(s: Schedule): FeedItem {
  const insight = readInsight(s.id);
  const slug = matchToSlug(s);
  const url = `${BASE}/match/${encodeURIComponent(slug)}`;
  const date = insight ? new Date(insight.generatedAt) : startDate(s);

  const commentaryTag =
    s.koreanCommentary === true
      ? " (한국어 해설)"
      : s.koreanCommentary === false
        ? " (현지 해설)"
        : "";

  const title = `[${s.league}] ${s.homeTeam} vs ${s.awayTeam} — ${s.date} ${s.time} ${s.platform}${commentaryTag}`;

  let descriptionHtml: string;
  if (insight) {
    const wp = insight.sections.watchPoints
      .map((w) => `<li>${xmlEscape(w)}</li>`)
      .join("");
    descriptionHtml = [
      `<p><strong>${xmlEscape(insight.sections.headline)}</strong></p>`,
      `<p>${xmlEscape(insight.sections.recentForm)}</p>`,
      `<p><em>${xmlEscape(insight.sections.keyMatchup)}</em></p>`,
      wp ? `<ul>${wp}</ul>` : "",
      `<p>${xmlEscape(s.league)} · ${xmlEscape(s.platform)} 중계${commentaryTag} · ${s.date} ${s.time} KST</p>`,
    ].join("");
  } else {
    descriptionHtml =
      `<p>${xmlEscape(s.league)} ${xmlEscape(s.homeTeam)} vs ${xmlEscape(s.awayTeam)} — ` +
      `${s.date} ${s.time} KST · ${xmlEscape(s.platform)} 중계${commentaryTag}.</p>` +
      `<p><a href="${xmlEscape(url)}">한해설에서 자세히 보기</a></p>`;
  }

  return {
    matchId: s.id,
    url,
    title,
    descriptionHtml,
    pubDate: date,
    weight: insight ? 2 : 1,
  };
}

/** 가이드(에디토리얼) 글을 피드 아이템으로. weight 3 = 매치보다 최우선. */
function buildGuideItem(g: Guide): FeedItem {
  const url = `${BASE}/guide/${g.slug}`;
  return {
    matchId: `guide-${g.slug}`,
    url,
    title: g.title,
    descriptionHtml:
      `<p>${xmlEscape(g.description)}</p>` +
      `<p><a href="${xmlEscape(url)}">한해설에서 자세히 보기</a></p>`,
    pubDate: new Date(`${g.updated ?? g.date}T09:00:00+09:00`),
    weight: 3,
  };
}

export async function GET(): Promise<Response> {
  const { schedules, lastUpdated } = loadScheduleData();
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1) 인사이트 있는 매치 + 오늘 이후 매치 우선 수집
  const candidates = schedules.filter((s) => {
    const insight = readInsight(s.id);
    return insight !== null || s.date >= todayStr;
  });

  // 2) 가이드(에디토리얼) 최우선 + 가중치(인사이트 우선) → pubDate 최신순, 50개 take
  const guideItems = getAllGuides().map(buildGuideItem);
  const items = [...guideItems, ...candidates.map(buildItem)]
    .sort((a, b) => {
      if (a.weight !== b.weight) return b.weight - a.weight;
      return b.pubDate.getTime() - a.pubDate.getTime();
    })
    .slice(0, 50);

  // 3) 빌드시 인사이트 0건 + 오늘 매치 0건이면 최근 진행/예정 매치로 폴백
  const finalItems =
    items.length > 0
      ? items
      : [...schedules]
          .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
          .slice(0, 50)
          .map(buildItem);

  const lastBuild = rfc822(new Date(lastUpdated));
  const selfUrl = `${BASE}/rss.xml`;

  const itemsXml = finalItems
    .map((it) => {
      return [
        "    <item>",
        `      <title>${cdata(it.title)}</title>`,
        `      <link>${xmlEscape(it.url)}</link>`,
        `      <guid isPermaLink="false">${xmlEscape(it.matchId)}</guid>`,
        `      <pubDate>${rfc822(it.pubDate)}</pubDate>`,
        `      <description>${cdata(it.descriptionHtml)}</description>`,
        `      <content:encoded>${cdata(it.descriptionHtml)}</content:encoded>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${cdata(FEED_TITLE)}</title>
    <link>${BASE}</link>
    <atom:link href="${selfUrl}" rel="self" type="application/rss+xml" />
    <description>${cdata(FEED_DESC)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <ttl>60</ttl>
${itemsXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
