/**
 * 한 시점의 게시 컨텐츠 묶음을 미리 빌드해서 폴더로 떨굼.
 * 호출 시 자식 프로세스로 실행됨 (KST_OFFSET_DAYS env가 자식 프로세스 진입 시 한 번만 적용되도록).
 *
 * 사용:
 *   KST_OFFSET_DAYS=0 npx tsx src/scripts/preview-build-one.ts 01-morning_today v1
 *   KST_OFFSET_DAYS=1 npx tsx src/scripts/preview-build-one.ts 02-evening_tomorrow v2
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { getKstToday } from "@/lib/instagram";
import { buildCaption } from "@/lib/instagram-api";
import { buildSocialComment } from "@/lib/social-comment";
import { UTM_LINKS } from "@/lib/utm";

const folder = process.argv[2];
const reelType = process.argv[3] === "v2" ? "v2" : "v1";

if (!folder) {
  console.error("사용: tsx preview-build-one.ts <folder> <v1|v2>");
  process.exit(1);
}

const offset = process.env.KST_OFFSET_DAYS ?? "1";
console.log(`\n📐 ${folder} 빌드 (KST_OFFSET_DAYS=${offset}, ${reelType})`);

// 0) 이전 빌드 잔재 청소 — 같은 generated/instagram 폴더를 쓰므로 다른 날짜 카드가 섞이지 않게.
const generatedDir = path.resolve("generated/instagram");
fs.rmSync(generatedDir, { recursive: true, force: true });
fs.mkdirSync(generatedDir, { recursive: true });

// 1) 카드 + 영상 + 스토리 생성 (env 상속)
execSync("npm run post:all -- --no-send", { stdio: "inherit" });
execSync(
  reelType === "v2" ? "npm run reel:make:v2" : "npm run reel:make",
  { stdio: "inherit" },
);
execSync("npm run story:make", { stdio: "inherit" });

// 2) preview 폴더로 복사
const PREVIEW_ROOT = path.resolve("generated/preview");
const PREVIEW_DIR = path.join(PREVIEW_ROOT, folder);
fs.rmSync(PREVIEW_DIR, { recursive: true, force: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });

const src = path.resolve("generated/instagram");
const skipPrefixes = ["_", "."];
const skipExact = new Set(["manifest.json", "_filter.txt"]);

for (const f of fs.readdirSync(src)) {
  if (skipExact.has(f)) continue;
  if (skipPrefixes.some((p) => f.startsWith(p))) continue;
  fs.copyFileSync(path.join(src, f), path.join(PREVIEW_DIR, f));
}

// 3) 캡션 + 첫 댓글 텍스트 (게시 시 실제로 들어갈 텍스트)
const { today, mm, dd } = getKstToday();
const captionFeed = buildCaption(mm, dd, today, UTM_LINKS.ig_post);
const captionReel = buildCaption(mm, dd, today, UTM_LINKS.ig_reel);
const comment = buildSocialComment(today);

fs.writeFileSync(
  path.join(PREVIEW_DIR, "00-caption-feed.txt"),
  `[인스타 캐러셀(피드) 캡션]\n${"=".repeat(60)}\n\n${captionFeed}\n`,
);
fs.writeFileSync(
  path.join(PREVIEW_DIR, "00-caption-reel.txt"),
  `[인스타 릴스/유튜브 쇼츠 캡션]\n${"=".repeat(60)}\n\n${captionReel}\n`,
);
fs.writeFileSync(
  path.join(PREVIEW_DIR, "00-first-comment.txt"),
  `[게시 후 첫 댓글 (인스타 캐러셀/릴스 둘 다 같은 텍스트)]\n${"=".repeat(60)}\n\n${comment}\n`,
);

// 4) README — 어떤 시점인지 안내
const dayLabel = offset === "0" ? "당일" : offset === "1" ? "내일" : `+${offset}일`;
const reelDesc = reelType === "v2"
  ? "신규 v2 (사진+타이틀 풀스크린 + 펀치 + xfade zoomin)"
  : "기존 슬라이드쇼 (카드들 페이드 전환)";
const readme = `# Preview — ${folder}

| 항목 | 값 |
|---|---|
| 게시 시점 | ${folder.includes("morning") ? "KST 05:00 (실제 노출 06~07시)" : "KST 19:18 (실제 노출 20~21시)"} |
| 대상 데이터 | ${dayLabel} (${today}) |
| 영상 종류 | ${reelDesc} |
| KST_OFFSET_DAYS | ${offset} |

## 파일 안내

- \`00-caption-feed.txt\` — 인스타 캐러셀(피드) 게시 시 캡션
- \`00-caption-reel.txt\` — 인스타 릴스 + 유튜브 쇼츠 캡션
- \`00-first-comment.txt\` — 게시 후 자동으로 다는 첫 댓글
- \`main-${mm}${dd}.png\` — 인스타 캐러셀 1번째 (V7 hook 카드)
- \`main-reel-${mm}${dd}.png\` — 영상 세이프존용 변형 (안 쓰여도 둠)
- \`soccer-*.png / baseball-*.png / basketball-*.png / volleyball-*.png\` — 종목별 카드
- \`outro.png\` — 캐러셀 마지막 카드
- \`story.png\` — 인스타 스토리
- \`reel.mp4\` 또는 \`reel-v2.mp4\` — 인스타 릴스 + 유튜브 쇼츠 영상
`;
fs.writeFileSync(path.join(PREVIEW_DIR, "README.md"), readme);

console.log(`✅ ${folder} 완료 → ${PREVIEW_DIR}`);
