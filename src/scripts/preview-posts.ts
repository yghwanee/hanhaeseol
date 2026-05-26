/**
 * 두 시점(오전/저녁) 게시 컨텐츠를 폴더별로 빌드해서 미리 확인할 수 있게 함.
 *
 * 결과:
 *   generated/preview/01-morning_today/   — 오전 워크플로우 결과 (offset 0, 기존 영상)
 *   generated/preview/02-evening_tomorrow/ — 저녁 워크플로우 결과 (offset 1, v2 영상)
 *
 * 각 폴더 안:
 *   - 캐러셀 카드 PNG들
 *   - 릴스 영상 mp4
 *   - 스토리 PNG
 *   - 캡션 / 첫 댓글 텍스트 (.txt)
 *   - README.md
 *
 * 실행: npm run preview
 */
import { execSync } from "node:child_process";

function run(folder: string, offset: number, reelType: "v1" | "v2") {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📦 ${folder}  (offset=${offset}, ${reelType})`);
  console.log("=".repeat(70));
  execSync(
    `npx tsx src/scripts/preview-build-one.ts ${folder} ${reelType}`,
    {
      stdio: "inherit",
      env: { ...process.env, KST_OFFSET_DAYS: String(offset) },
    },
  );
}

run("01-morning_today", 0, "v1");
run("02-evening_tomorrow", 1, "v2");

console.log(`\n${"=".repeat(70)}`);
console.log("✅ 모든 preview 빌드 완료");
console.log("   결과: generated/preview/");
console.log("=".repeat(70));
