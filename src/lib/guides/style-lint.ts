/**
 * 가이드 글 문체 검사.
 *
 * `docs/guide-style.md`에 규칙을 아무리 적어도 초안은 그걸 형식으로만 충족한다.
 * "짧은 문장을 섞어라"라고 하면 "이번엔 달라요." 한 줄을 기계적으로 끼워 넣고,
 * "표 1개 권장"이라고 하면 모든 글에 정확히 표가 하나씩 박힌다.
 * 규칙은 지켜지는데 글은 여전히 찍어낸 티가 난다.
 *
 * 그래서 지시가 아니라 검사로 막는다. 여기서 잡는 건 전부 실제 발행글에서 나온 패턴이다.
 */

export type Severity = "error" | "warn";

export type Finding = {
  severity: Severity;
  rule: string;
  message: string;
  /** 문제가 된 실제 텍스트 (사람이 바로 찾을 수 있게) */
  sample?: string;
};

const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

/**
 * 이모지 판정.
 * `\p{Extended_Pictographic}`는 tsconfig target이 es5라 tsc가 거부한다(TS1501).
 * 서로게이트 페어와 기호 블록을 직접 잡는다.
 */
const EMOJI = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[←-⇿⌀-⏿☀-➿⬀-⯿️〰]/g;

export function stripFrontmatter(md: string): string {
  return md.replace(FRONTMATTER, "");
}

/** 표·코드블록·링크를 걷어낸 산문만 남긴다. 리듬 검사는 산문에만 해야 한다. */
export function proseOnly(body: string): string {
  return body
    .split("\n")
    .filter((l) => !l.trim().startsWith("|") && !l.trim().startsWith("#"))
    .join("\n")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

export function paragraphs(body: string): string[] {
  return proseOnly(body)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?요]\s)|(?<=다\.)|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/** 소제목을 라벨처럼 붙이는 습관. 사람은 글 안에서 이런 제목을 잘 안 단다. */
const LABEL_HEADINGS = [
  "시청 조건",
  "주요 일정",
  "요금",
  "요금 비교",
  "중계 정보",
  "정리",
  "마무리",
  "결론",
  "개요",
  "배경",
  "일정",
  "가격",
  "시청 방법",
  "보는 법",
  "한국어 해설",
];

/** 매 글이 같은 문장으로 닫히는 것. 제일 티 나는 자리다. */
const FORMULAIC_CLOSERS =
  /(한해설|haeseol\.com)[^.\n]{0,40}(에서|에서도)[^.\n]{0,40}(확인|볼 수 있|보실 수 있|체크)/;

/** 매 글이 같은 문장으로 열리는 것. */
const FORMULAIC_OPENERS =
  /(정리해\s?봤|총정리했|한눈에 보면|결론부터 말하면|이번 글에서는|알아보겠습니다)/;

/** 주어 없는 감정. "의견을 넣어라"를 형식으로만 충족할 때 나오는 말투. */
const SUBJECTLESS_EMOTION =
  /(기대되는 게 사실|복잡한 감정이|묘한 기분이|아쉬운 게 사실|반가운 게 사실|기분이 드는 (경기|일)이 될 것 같)/;

export function lintGuide(markdown: string): Finding[] {
  const out: Finding[] = [];
  const body = stripFrontmatter(markdown);
  const push = (severity: Severity, rule: string, message: string, sample?: string) =>
    out.push({ severity, rule, message, sample });

  // --- 표면 규칙: 있으면 무조건 잘못된 것 ---
  const dash = body.match(/[—–]/);
  if (dash) push("error", "dash", "줄표(— –)는 쓰지 않는다. 마침표나 쉼표로 끊는다.", dash[0]);

  const curly = body.match(/[“”‘’]/);
  if (curly) push("error", "curly-quote", "굽은 따옴표 대신 곧은 따옴표를 쓴다.", curly[0]);

  for (const line of body.split("\n")) {
    if (/^#{1,6}\s/.test(line) && new RegExp(EMOJI.source).test(line)) {
      push("error", "emoji-heading", "소제목에 이모지를 박지 않는다.", line.trim());
    }
  }

  const headings = body
    .split("\n")
    .filter((l) => /^#{2,6}\s/.test(l))
    // 이모지가 붙어 있어도 라벨 판정은 되어야 한다
    .map((l) =>
      l
        .replace(/^#+\s*/, "")
        .replace(EMOJI, "")
        .trim(),
    );

  for (const h of headings) {
    if (LABEL_HEADINGS.includes(h)) {
      push(
        "error",
        "label-heading",
        `소제목 "${h}"는 라벨이다. 그 대목에서 실제로 하려는 말을 제목으로 쓰거나, 소제목 없이 문단으로 잇는다.`,
        h,
      );
    }
  }

  const tableCount = body.split("\n").filter((l) => /^\|.*\|$/.test(l.trim()) && /---/.test(l)).length;
  if (tableCount > 1) {
    push("error", "too-many-tables", `표가 ${tableCount}개다. 한 글에 표는 많아야 하나다.`);
  }

  const paras = paragraphs(body);
  const first = paras[0] ?? "";
  const last = paras[paras.length - 1] ?? "";

  if (FORMULAIC_OPENERS.test(first)) {
    push("error", "formulaic-opener", "정형 오프너로 시작하지 않는다. 그날 제일 하고 싶은 말부터 들어간다.", first.slice(0, 40));
  }
  if (FORMULAIC_CLOSERS.test(last)) {
    push(
      "error",
      "formulaic-closer",
      "매 글이 같은 문장으로 닫히면 제일 티 난다. 링크는 본문에 녹이고 마무리는 글마다 다르게.",
      last.slice(0, 50),
    );
  }

  const emotion = body.match(SUBJECTLESS_EMOTION);
  if (emotion) {
    push(
      "error",
      "subjectless-emotion",
      "감정의 주어가 없다. 글쓴이가 실제로 뭘 느꼈는지 쓰거나, 아예 빼고 사실만 쓴다.",
      emotion[0],
    );
  }

  // --- 리듬: 어겼다고 못 쓸 글은 아니라서 경고 ---
  if (paras.length >= 3) {
    const lens = paras.map((p) => p.length);
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    const spread = Math.sqrt(
      lens.reduce((acc, l) => acc + (l - avg) ** 2, 0) / lens.length,
    );
    // 편차가 평균의 30% 미만이면 문단이 죄다 같은 크기라는 뜻이다.
    if (spread / avg < 0.3) {
      push(
        "warn",
        "even-paragraphs",
        `문단 길이가 고르다(평균 ${Math.round(avg)}자, 편차 ${Math.round(spread)}). 길게 풀 데는 풀고 짧게 끊을 데는 끊는다.`,
      );
    }
  }

  const all = sentences(proseOnly(body));
  if (all.length >= 6) {
    const polite = all.filter((s) => /(요|에요|예요|어요|아요)[.!?]?$/.test(s)).length;
    if (polite / all.length > 0.9) {
      push(
        "warn",
        "monotone-endings",
        `문장 ${all.length}개 중 ${polite}개가 같은 어미로 끝난다. 종결을 섞는다.`,
      );
    }
  }

  return out;
}

export function formatFindings(file: string, findings: Finding[]): string {
  if (findings.length === 0) return "";
  const lines = [`## ${file}`];
  for (const f of findings) {
    const mark = f.severity === "error" ? "✖" : "△";
    lines.push(`${mark} [${f.rule}] ${f.message}${f.sample ? `  ← "${f.sample}"` : ""}`);
  }
  return lines.join("\n");
}
