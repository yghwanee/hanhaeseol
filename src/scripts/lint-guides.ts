/**
 * 가이드 글 문체 검사 실행기.
 *
 * 인자로 파일 경로를 주면 그것만, 없으면 src/content/guides/*.md 전부 검사한다.
 * error가 하나라도 있으면 exit 1 → 자동 발행 워크플로가 그 초안을 막는다.
 * warn은 리듬 문제라 사람이 보고 판단할 몫이라 종료 코드를 바꾸지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { lintGuide, formatFindings } from "../lib/guides/style-lint";

const GUIDES_DIR = path.join(process.cwd(), "src", "content", "guides");

function targets(): string[] {
  const args = process.argv.slice(2);
  if (args.length > 0) return args;
  if (!fs.existsSync(GUIDES_DIR)) return [];
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(GUIDES_DIR, f));
}

function main() {
  const files = targets();
  let errors = 0;
  let warns = 0;
  const reports: string[] = [];

  for (const file of files) {
    const findings = lintGuide(fs.readFileSync(file, "utf8"));
    if (findings.length === 0) continue;
    errors += findings.filter((f) => f.severity === "error").length;
    warns += findings.filter((f) => f.severity === "warn").length;
    reports.push(formatFindings(path.basename(file), findings));
  }

  if (reports.length > 0) console.log(reports.join("\n\n"));
  console.log(`\n검사 ${files.length}편 · 오류 ${errors} · 경고 ${warns}`);

  if (errors > 0) process.exit(1);
}

main();
