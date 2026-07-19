/**
 * 주간 글감 이슈가 기존 큐·발행글과 겹치는지 검사해 리포트를 낸다.
 *
 * 사용:
 *   ISSUE_BODY="$(gh issue view 20 --json body -q .body)" npm run check:idea-dupes
 *   npm run check:idea-dupes -- path/to/issue-body.txt
 *
 * 겹쳐도 exit 0 — 판정이 아니라 사람에게 주는 경고다.
 * GITHUB_OUTPUT이 있으면 report 출력을 워크플로로 넘긴다.
 */
import fs from "node:fs";
import path from "node:path";
import {
  parseIdeas,
  parseContentPlan,
  toExistingGuides,
  findDuplicates,
  renderReport,
  type ExistingItem,
} from "../lib/guides/idea-dupes";

const ROOT = process.cwd();
const PLAN_PATH = path.join(ROOT, "docs", "content-plan.md");
const GUIDES_DIR = path.join(ROOT, "src", "content", "guides");

function readIssueBody(): string {
  const fileArg = process.argv[2];
  if (fileArg) return fs.readFileSync(fileArg, "utf8");
  const env = process.env.ISSUE_BODY;
  if (env && env.trim()) return env;
  throw new Error("이슈 본문이 없습니다. ISSUE_BODY 환경변수나 파일 경로를 주세요.");
}

/** 가이드 md의 frontmatter에서 title만 뽑는다 (별도 파서를 들이지 않는다). */
function readGuides(): ExistingItem[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith(".md"));
  return toExistingGuides(
    files.map((file) => {
      const raw = fs.readFileSync(path.join(GUIDES_DIR, file), "utf8");
      const title = /^title:\s*(.+)$/m.exec(raw)?.[1]?.trim() ?? "";
      return { slug: file.replace(/\.md$/, ""), title };
    }),
  );
}

function main() {
  const ideas = parseIdeas(readIssueBody());
  if (ideas.length === 0) {
    console.log("글감 줄(`N. 제목 (slug: ...)`)을 찾지 못했습니다. 이슈 형식을 확인하세요.");
    return;
  }

  const existing = [
    ...parseContentPlan(fs.readFileSync(PLAN_PATH, "utf8")),
    ...readGuides(),
  ];
  const matches = findDuplicates(ideas, existing);
  const report = renderReport(matches);

  console.log(
    `글감 ${ideas.length}건 · 대조 대상 ${existing.length}건 · 겹침 ${matches.length}건`,
  );
  console.log(report || "✅ 겹치는 글감 없음");

  const outPath = process.env.GITHUB_OUTPUT;
  if (outPath) {
    // 여러 줄 출력은 heredoc 형식으로 넘겨야 한다
    fs.appendFileSync(outPath, `report<<HHS_EOF\n${report}\nHHS_EOF\n`);
    fs.appendFileSync(outPath, `count=${matches.length}\n`);
  }
}

main();
