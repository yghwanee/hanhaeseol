/**
 * 주간 글감 이슈 ↔ 기존 큐/발행글 중복 검사.
 *
 * 주간 글감 루틴(claude.ai)은 content-plan.md도 src/content/guides/도 읽지 않는다.
 * 그래서 이미 큐에 있거나 이미 발행한 주제를 그대로 다시 제안하는 일이 생긴다.
 * (2026-07-19 이슈 #20에서 이정후·EPL·KBO 3건이 겹쳤고, 사람이 눈으로 잡았다.)
 *
 * 여기서는 판정을 하지 않고 **사람에게 경고만** 띄운다.
 * 오탐 비용은 "한 줄 더 읽기"뿐이라 느슨하게 잡는 쪽이 낫다.
 */

export type Idea = {
  /** 이슈 목록에서의 번호 (1-based) */
  index: number;
  title: string;
  slug: string;
};

export type ExistingItem = {
  slug: string;
  title: string;
  /** 어디서 왔는지 — 경고 문구에 그대로 쓴다 */
  source: string;
};

export type DupeMatch = {
  idea: Idea;
  existing: ExistingItem;
  /** exact = slug가 같음, similar = 주제가 겹쳐 보임 */
  kind: "exact" | "similar";
  /** 겹친 근거 토큰 (사람이 판단할 재료) */
  shared: string[];
};

/** slug에서 주제 식별력이 없는 토큰. 이게 겹치는 건 근거가 못 된다. */
const GENERIC_SLUG_TOKENS = new Set([
  "2024",
  "2025",
  "2026",
  "2027",
  "25",
  "26",
  "27",
  "broadcast",
  "guide",
  "how",
  "to",
  "watch",
  "watching",
  "where",
  "the",
  "a",
]);

/** 우리 글 제목엔 거의 항상 들어가는 말 — 겹쳐도 의미 없다. */
const GENERIC_TITLE_WORDS = new Set([
  "중계",
  "해설",
  "한국어",
  "한국어해설",
  "어디서",
  "보나",
  "보는",
  "보기",
  "볼",
  "법",
  "방법",
  "경기",
  "정리",
  "총정리",
  "완전정리",
  "가이드",
  "시청",
  "채널",
  "이제",
  "지금",
  "한국",
  "한국에서",
  "있나",
  "되나",
  "시즌",
  "일정",
  "여부",
]);

/**
 * 조사 때문에 같은 말이 다른 토큰이 된다(`무료` ↔ `무료로`).
 * 조사를 떼는 방식은 `쇼헤이` → `쇼헤`, `쿠팡플레이` → `쿠팡플레`처럼
 * 고유명사를 깎아버려서 폐기했다(2026-07-20). 대신 토큰을 원형 그대로 두고
 * 비교할 때만 접두 일치를 허용한다.
 */
function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  // 2글자 이상이 접두로 겹치고 꼬리가 조사 수준(2글자 이내)일 때만
  if (short.length < 2 || long.length - short.length > 2) return false;
  return long.startsWith(short);
}

export function slugTokens(slug: string): string[] {
  return slug
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !GENERIC_SLUG_TOKENS.has(t));
}

export function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/)
    // 순수 숫자·"7월" 같은 날짜 토큰은 주제를 가르지 못한다
    .filter(
      (t) =>
        t.length >= 2 &&
        !/^\d+$/.test(t) &&
        !/^\d{1,2}월$/.test(t) &&
        !GENERIC_TITLE_WORDS.has(t),
    );
}

function intersect(a: string[], b: string[]): string[] {
  return [...new Set(a)].filter((t) => b.some((u) => tokenMatches(t, u)));
}

/**
 * 이슈 본문의 "💡 글감 10개" 목록을 파싱한다.
 * 형식: `1. 🔴 제목 ... (slug: some-slug)`
 * slug가 없는 줄은 대조할 수 없으니 버린다.
 */
export function parseIdeas(issueBody: string): Idea[] {
  const out: Idea[] = [];
  for (const rawLine of issueBody.split("\n")) {
    const line = rawLine.trim();
    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (!numbered) continue;

    const index = Number(numbered[1]);
    const rest = numbered[2];
    const slugMatch = /\(slug:\s*([a-z0-9-]+)\s*\)/i.exec(rest);
    if (!slugMatch) continue;

    const title = rest
      .slice(0, slugMatch.index)
      .replace(/^🔴\s*/, "")
      .trim();
    out.push({ index, title, slug: slugMatch[1].toLowerCase() });
  }
  return out;
}

/**
 * content-plan.md의 체크박스 줄을 파싱한다.
 * 형식: `- [ ] 제목 (slug: some-slug) (고정: 2026-07-21) — 메모`
 * 섹션 헤더(`## ★ 메인 큐`)를 따라가며 출처를 붙인다.
 */
export function parseContentPlan(planMd: string): ExistingItem[] {
  const out: ExistingItem[] = [];
  let section = "content-plan.md";

  for (const rawLine of planMd.split("\n")) {
    const line = rawLine.trim();

    const header = /^##\s+(.*)$/.exec(line);
    if (header) {
      section = header[1].trim();
      continue;
    }

    const item = /^-\s*\[( |x|X)\]\s+(.*)$/.exec(line);
    if (!item) continue;

    const done = item[1].toLowerCase() === "x";
    const rest = item[2];
    const slugMatch = /\(slug:\s*([a-z0-9-]+)\s*\)/i.exec(rest);
    if (!slugMatch) continue;

    const title = rest
      .slice(0, slugMatch.index)
      .replace(/\*\*/g, "")
      .trim();
    out.push({
      slug: slugMatch[1].toLowerCase(),
      title,
      source: `${section}${done ? " (발행 완료)" : ""}`,
    });
  }
  return out;
}

/** 발행된 가이드 파일 목록 → 대조 대상. title은 frontmatter에서 온다. */
export function toExistingGuides(
  guides: { slug: string; title: string }[],
): ExistingItem[] {
  return guides.map((g) => ({
    slug: g.slug.toLowerCase(),
    title: g.title,
    source: "발행글(src/content/guides)",
  }));
}

/**
 * 겹침 판정.
 * - slug가 같으면 exact.
 * - slug 의미 토큰이 2개 이상 겹치거나, 제목 의미 단어가 2개 이상 겹치면 similar.
 *
 * 임계값 2는 실측 기준이다. 1로 내리면 "쿠팡플레이"만 같아도 다 걸려 경고가 무의미해지고,
 * 3으로 올리면 EPL 사례(`epl-2026-27-coupang-august-kickoff` ↔ `epl-2026-27-broadcast`)를 놓친다.
 */
const MAX_MATCHES_PER_IDEA = 2;

export function findDuplicates(
  ideas: Idea[],
  existing: ExistingItem[],
): DupeMatch[] {
  const out: DupeMatch[] = [];

  for (const idea of ideas) {
    const ideaSlug = slugTokens(idea.slug);
    const ideaTitle = titleTokens(idea.title);
    const exact = existing.find((item) => item.slug === idea.slug);

    if (exact) {
      out.push({ idea, existing: exact, kind: "exact", shared: [exact.slug] });
      continue;
    }

    const candidates: { match: DupeMatch; score: number }[] = [];
    for (const item of existing) {
      const sharedSlug = intersect(ideaSlug, slugTokens(item.slug));
      const sharedTitle = intersect(ideaTitle, titleTokens(item.title));
      if (sharedSlug.length < 2 && sharedTitle.length < 2) continue;

      candidates.push({
        match: {
          idea,
          existing: item,
          kind: "similar",
          shared: [...new Set([...sharedSlug, ...sharedTitle])],
        },
        // slug는 주제 키라서 제목 단어보다 무겁게 본다.
        // (제목의 "쿠팡플레이·확정"이 겹쳤다고 EPL 글감이 이강인 글에 붙던 것 방지)
        score: sharedSlug.length * 2 + sharedTitle.length,
      });
    }

    // 근거가 센 순으로 최대 2개. 1개만 보이면 더 센 매치가 진짜 중복을 가린다.
    candidates.sort((a, b) => b.score - a.score);
    out.push(...candidates.slice(0, MAX_MATCHES_PER_IDEA).map((c) => c.match));
  }

  return out;
}

/** 이슈 코멘트/텔레그램에 그대로 붙일 마크다운. 겹침이 없으면 빈 문자열. */
export function renderReport(matches: DupeMatch[]): string {
  if (matches.length === 0) return "";

  const lines = ["⚠️ 기존 큐·발행글과 겹치는 글감이 있습니다.", ""];
  for (const m of matches) {
    const mark = m.kind === "exact" ? "🔴 중복" : "⚠️ 유사";
    lines.push(
      `- ${mark} · ${m.idea.index}번 \`${m.idea.slug}\` ↔ \`${m.existing.slug}\` (${m.existing.source})`,
    );
    lines.push(`  - 겹친 근거: ${m.shared.join(", ")}`);
  }
  lines.push("");
  lines.push("큐에 넣기 전에 각도를 바꾸거나 빼세요.");
  return lines.join("\n");
}
