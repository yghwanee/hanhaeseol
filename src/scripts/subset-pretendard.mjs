/**
 * Pretendard 웹 폰트 서브셋 생성기 (수동 실행 도구).
 *
 * 🔴 왜 필요한가: `public/fonts/Pretendard-{Regular,Bold}.otf` 는 각각 1.5MB 다.
 * 이 폰트를 화면에서 쓰는 곳은 **ebook 배너 인용구 한 곳뿐**인데(`EbookBanner.tsx`),
 * 홈에 항상 렌더되므로 방문자마다 3MB 를 받고 있었다.
 *
 * 그래서 브라우저용으로는 **그 배너에 실제로 나올 수 있는 글자만** 담은 woff2 를 쓴다.
 * 원본 OTF 는 지우지 않는다 — OG 이미지 라우트(`opengraph-image.tsx`)가 임의의
 * 팀명·제목을 그리므로 전체 글리프가 필요하고, 그쪽은 서버에서 한 번 받아 캐시한다.
 *
 * 실행: `npm run fonts:subset` (pyftsubset 필요 — `pip install fonttools brotli`)
 * 글자 집합이 바뀌면 `npm run test:ebook-font` 가 CI 에서 실패한다.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { requiredGlyphChars } from "./_ebook-font-chars.mjs";

const OUT_DIR = path.resolve("public/fonts");
const SOURCES = [
  ["Pretendard-Regular.otf", "Pretendard-Regular.subset.woff2"],
  ["Pretendard-Bold.otf", "Pretendard-Bold.subset.woff2"],
];

const chars = requiredGlyphChars();
const unicodes = [...chars].map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase()).join(",");
console.log(`서브셋 글자 수: ${chars.size}`);

for (const [src, out] of SOURCES) {
  const from = path.join(OUT_DIR, src);
  const to = path.join(OUT_DIR, out);
  execFileSync("pyftsubset", [
    from,
    `--unicodes=${unicodes}`,
    "--layout-features=*",
    "--flavor=woff2",
    `--output-file=${to}`,
  ], { stdio: "inherit" });
  const before = fs.statSync(from).size;
  const after = fs.statSync(to).size;
  console.log(`${src} ${(before / 1024).toFixed(0)}KB → ${out} ${(after / 1024).toFixed(1)}KB`);
}

// 실제로 구운 글자 집합을 남긴다. woff2 는 압축돼 있어 cmap 을 직접 못 읽으므로,
// 가드 테스트(`ebook-font.test.ts`)는 이 파일과 대조해 "다시 굽지 않은 것"을 잡는다.
fs.writeFileSync(
  path.join(OUT_DIR, "subset-chars.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), chars: [...chars].sort() }, null, 0) + String.fromCharCode(10),
  "utf8",
);
console.log("subset-chars.json 갱신");
