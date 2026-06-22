/**
 * 가이드(에디토리얼) 콘텐츠 로더.
 *
 * 매치/편성 페이지는 전부 자동생성 데이터라 사이트가 "유틸리티"로 인식된다.
 * 사람이 쓴 가이드 글을 별도 섹션(/guide)으로 쌓아 "콘텐츠 사이트" 성격을 만들고,
 * 검색 유입·체류·AdSense 품질 평가를 끌어올리는 것이 목적.
 *
 * 글은 src/content/guides/*.md 에 마크다운으로 저장한다(폰에서도 수정 쉽게).
 * 빌드/SSR 시점에 fs로 읽어 marked로 HTML 변환한다. (정적 export 아님 → fs 사용 가능)
 */
import fs from "fs";
import path from "path";
import { marked } from "marked";

const GUIDES_DIR = path.join(process.cwd(), "src/content/guides");

export interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  /** 발행일 YYYY-MM-DD */
  date: string;
  /** 최종 수정일 YYYY-MM-DD (없으면 date와 동일 취급) */
  updated?: string;
  /** 분류 라벨 (예: 월드컵, 해외축구, KBO) */
  category?: string;
}

export interface Guide extends GuideMeta {
  /** 본문 마크다운 원문 */
  bodyMarkdown: string;
  /** 렌더된 HTML */
  bodyHtml: string;
}

/**
 * 아주 단순한 frontmatter 파서. YAML 의존성 없이 `key: value` 한 줄씩만 파싱한다.
 * 값에 콜론이 들어가도 첫 콜론 기준으로만 자르므로 description 등에 문제없다.
 */
function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  body: string;
} {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { data: {}, body: text };

  const closing = text.indexOf("\n---", 4);
  if (closing === -1) return { data: {}, body: text };

  const fm = text.slice(4, closing);
  const body = text.slice(closing + 4).replace(/^\n+/, "");

  const data: Record<string, string> = {};
  for (const line of fm.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return { data, body };
}

export function getAllGuideSlugs(): string[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function getGuide(slug: string): Guide | null {
  const file = path.join(GUIDES_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;

  const raw = fs.readFileSync(file, "utf8");
  const { data, body } = parseFrontmatter(raw);
  // breaks: true → 마크다운에서 엔터 한 번(단일 개행)도 <br>로 변환.
  // 글쓴이가 친 줄바꿈이 화면에 그대로 반영돼 직관적이고, 줄바꿈 제어가 쉬워진다.
  const bodyHtml = marked.parse(body, {
    async: false,
    gfm: true,
    breaks: true,
  }) as string;

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? "",
    updated: data.updated || undefined,
    category: data.category || undefined,
    bodyMarkdown: body,
    bodyHtml,
  };
}

/** 모든 가이드를 발행일 내림차순(최신 먼저)으로 반환. */
export function getAllGuides(): Guide[] {
  return getAllGuideSlugs()
    .map(getGuide)
    .filter((g): g is Guide => g !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}
