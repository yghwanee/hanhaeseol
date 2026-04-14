import { AnalysisArticle } from "@/types/analysis";
import { Schedule, Sport } from "@/types/schedule";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

interface LivemanPost {
  url: string;
  title: string;
  date: string;  // "MM-DD"
  homeTeam: string;
  awayTeam: string;
  sport: Sport;
}

const BOARDS: { table: string; path: string; sport: Sport }[] = [
  { table: "soccer", path: "soccer", sport: "축구" },
  { table: "baseball", path: "baseball", sport: "야구" },
  { table: "basket", path: "basket", sport: "농구" },
];

// 제목에서 날짜, 팀명 파싱
function parseTitle(title: string): { month: string; day: string; homeTeam: string; awayTeam: string } | null {
  // 패턴1: "4월 15일 UCL AT마드 vs 바르셀로나" (축구/야구)
  const match1 = title.match(/(\d+)월\s*(\d+)일\s+\S+\s+(.+?)\s+vs\s+(.+)/);
  if (match1) {
    return {
      month: match1[1].padStart(2, "0"),
      day: match1[2].padStart(2, "0"),
      homeTeam: match1[3].trim(),
      awayTeam: match1[4].trim(),
    };
  }

  // 패턴2: "2026-04-13 07:00 NBA 보스턴 셀틱스 vs 올랜도 매직" (농구)
  const match2 = title.match(/\d{4}-(\d{2})-(\d{2})\s+\d+:\d+\s+\S+\s+(.+?)\s+vs\s+(.+)/);
  if (match2) {
    return {
      month: match2[1],
      day: match2[2],
      homeTeam: match2[3].trim(),
      awayTeam: match2[4].trim(),
    };
  }

  return null;
}

// liveman 팀명과 schedule 팀명 매칭
const LIVEMAN_ALIAS: Record<string, string> = {
  // 축구
  "AT마드": "아틀레티코 마드리드",
  "AT마드리드": "아틀레티코 마드리드",
  "인테르": "인터 밀란",
  "바르샤": "바르셀로나",
  "코모1907": "코모 1907",
  // 농구
  "보스턴 셀틱스": "보스턴",
  "올랜도 매직": "올랜도",
  "클리블랜드 캐벌리어스": "클리블랜드",
  "워싱턴 위자드": "워싱턴",
  "인디애나 페이서스": "인디애나",
  "디트로이트 피스톤스": "디트로이트",
  "마이애미 히트": "마이애미",
  "애틀랜타 호크스": "애틀랜타",
  "뉴욕 닉스": "뉴욕",
  "샬럿 호네츠": "샬럿",
  "골든스테이트 워리어스": "골든스테이트",
  "LA 클리퍼스": "LA 클리퍼스",
  "LA 레이커스": "LA 레이커스",
  "유타 재즈": "유타",
  "덴버 너게츠": "덴버",
  "샌안토니오 스퍼스": "샌안토니오",
  "밀워키 벅스": "밀워키",
  "피닉스 선즈": "피닉스",
};

function matchTeam(livemanName: string, scheduleName: string): boolean {
  const alias = LIVEMAN_ALIAS[livemanName];
  if (alias) {
    return scheduleName.includes(alias) || alias.includes(scheduleName);
  }
  // 공백 제거 후 비교
  const a = livemanName.replace(/\s+/g, "");
  const b = scheduleName.replace(/\s+/g, "");
  return a.includes(b) || b.includes(a) || a === b;
}

// 목록 페이지에서 글 링크 수집
async function fetchPostList(table: string, pathName: string, sport: Sport): Promise<LivemanPost[]> {
  const res = await fetch(`https://liveman.kr/bbs/board.php?bo_table=${table}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];

  const html = await res.text();
  const posts: LivemanPost[] = [];

  const pattern = new RegExp(
    `href="(https://liveman\\.kr/${pathName}/\\d+)"\\s+class="na-subject">\\s*(?:<[^>]*>)*\\s*([^<]+)`,
    "g"
  );
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    const parsed = parseTitle(title);
    if (!parsed) continue;
    if (posts.some((p) => p.url === url)) continue;

    posts.push({
      url,
      title,
      date: `${parsed.month}-${parsed.day}`,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      sport,
    });
  }

  return posts;
}

// 상세 페이지에서 본문 추출
async function fetchArticleContent(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const html = await res.text();

  // bo_v_con 시작 ~ 추천/비추천 버튼 또는 관련자료 전까지
  const conMatch = html.match(/id="bo_v_con"[^>]*>([\s\S]*?)(?:<button[^>]*title="추천"|<h3[^>]*>관련자료|<div[^>]*class="[^"]*bo_v_com|<!-- 댓글)/);
  if (!conMatch) return null;

  const content = conMatch[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[2-4]>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    // 추천/비추천/댓글/하단 잔여 텍스트 제거
    .replace(/\d+\s*추천\s*\d+\s*비추천[\s\S]*/g, "")
    // 하단에 반복되는 제목 제거
    .replace(/\n\s*\d+월\s*\d+일\s+.+?\s+vs\s+.+\s*$/g, "")
    .trim();

  // 본문 앞의 제목/소제목 제거 ("4월 15일 UCL 경기 분석\n AT마드 vs 바르셀로나")
  const cleaned = content
    .replace(/^\s*\d+월\s*\d+일\s+\S+\s+경기\s*분석\s*\n\s*.+?\s+vs\s+.+?\n/, "")
    .replace(/^\s+/, "")
    .trim();

  if (cleaned.length < 50) return null;
  return cleaned;
}

export async function crawlLiveman(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanMatches = schedules.filter(
    (s) => s.date === date  &&
      (s.sport === "축구" || s.sport === "야구" || s.sport === "농구")
  );
  if (koreanMatches.length === 0) return [];

  console.log("  liveman: 글 목록 가져오는 중...");

  // 모든 게시판에서 글 수집
  const allPosts: LivemanPost[] = [];
  for (const board of BOARDS) {
    try {
      const posts = await fetchPostList(board.table, board.path, board.sport);
      allPosts.push(...posts);
    } catch {
      // 개별 게시판 실패 무시
    }
  }
  console.log(`  liveman: ${allPosts.length}개 글 발견`);

  // 요청한 날짜에 해당하는 글만 필터
  const [, month, day] = date.split("-");
  const dateKey = `${month}-${day}`;
  const datePosts = allPosts.filter((p) => p.date === dateKey);

  if (datePosts.length === 0) return [];

  // schedule 매칭
  const articles: AnalysisArticle[] = [];

  for (const post of datePosts) {
    const matched = koreanMatches.find(
      (s) =>
        s.sport === post.sport &&
        ((matchTeam(post.homeTeam, s.homeTeam) && matchTeam(post.awayTeam, s.awayTeam)) ||
         (matchTeam(post.homeTeam, s.awayTeam) && matchTeam(post.awayTeam, s.homeTeam)))
    );
    if (!matched) continue;

    const content = await fetchArticleContent(post.url);
    if (!content) continue;

    console.log(`  ✓ ${post.homeTeam} vs ${post.awayTeam} (${post.sport})`);

    const postId = post.url.match(/\/(\d+)$/)?.[1] || "";
    articles.push({
      id: `${date}-liveman-${postId}`,
      date,
      time: matched.time,
      sport: matched.sport,
      league: matched.league,
      homeTeam: matched.homeTeam,
      awayTeam: matched.awayTeam,
      homeTeamEn: "",
      awayTeamEn: "",
      sourceUrl: post.url,
      prediction: "",
      content,
      crawledAt: new Date().toISOString(),
    });
  }

  console.log(`  liveman: ${articles.length}건 수집`);
  return articles;
}
