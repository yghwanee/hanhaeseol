/**
 * 화면 전역용 Pretendard 서브셋 생성기 (수동 실행 도구).
 *
 * 🔴 왜 필요한가: 종전 본문 폰트는 **Geist 였고 Geist 에는 한글 글리프가 하나도 없다.**
 * 그래서 사이트의 모든 한글이 OS 기본 폰트로 떨어지고 있었다 — 윈도우는 맑은 고딕,
 * 맥은 Apple SD Gothic Neo. 기기마다 자·간격·굵기가 달라 "폰트가 이상하다"로 보였다
 * (2026-09-03 사용자 지적). 라틴은 Geist, 한글은 시스템 폰트라 한 줄 안에서 두 폰트가
 * 섞이는 것도 원인이었다.
 *
 * 🔴 왜 전체 폰트를 안 쓰는가 (실측, 2026-09-03):
 *   - 전체(14,336자)            771KB × 2가중치 = 1.5MB
 *   - 한글 음절 11,172자만       623KB
 *   - 음절 블록 20등분 청크      1개 35KB → 실제 페이지가 12개쯤 물어 약 420KB
 *   - **이 사이트가 실제 쓰는 글자만  119KB + 120KB = 239KB** ← 이걸 쓴다
 *
 * 1.5MB 는 못 쓴다. 이 프로젝트는 2026-08-17 에 Vercel Hobby 한도(Fast Origin
 * Transfer 12.63/10GB)를 넘겨 계정이 잠긴 이력이 있고, 홈 HTML 이 327KB 다.
 * 방문자마다 폰트로 1.5MB 를 더 태우면 그 사고를 그대로 재현한다.
 *
 * 🔴 서브셋에 없는 글자는 어떻게 되나: **두부(□)가 아니라 시스템 한글 폰트로 떨어진다.**
 * `globals.css` 의 폴백 체인이 `Apple SD Gothic Neo` → `Malgun Gothic` 순이라, 새로
 * 크롤된 선수 이름에 낯선 음절이 하나 있으면 그 글자만 시스템 폰트로 그려진다.
 * 눈에 거의 안 띄고, 그 대신 전체 폰트 771KB 를 받는 일이 없다.
 * (unicode-range 를 안 쓰는 이유가 이것이다 — 쓰면 브라우저가 폴백 face 를 받아 온다.)
 *
 * 크롤 데이터가 매시 바뀌므로 커버리지는 시간이 지나면 조금씩 새어 나간다. 새 리그·새
 * 선수가 많이 들어온 뒤에 이 스크립트를 다시 돌리면 된다. CI 가드는 일부러 안 만들었다 —
 * 코드 회귀가 아니라 데이터 변화라서 새 이름마다 빨개진다(alias 감사와 같은 판단).
 *
 * 실행: `npm run fonts:subset:ui` (pyftsubset 필요 — `pip install fonttools brotli`)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("public/fonts");
const SOURCES = [
  ["Pretendard-Regular.otf", "Pretendard-Regular.ui.woff2"],
  ["Pretendard-Bold.otf", "Pretendard-Bold.ui.woff2"],
];

/** 코퍼스를 긁을 곳. 화면에 나올 수 있는 글자는 전부 이 안에 있다. */
const SCAN_ROOTS = ["src", "docs", "templates", "assets", "public", "data"];
const SCAN_EXT = [".json", ".ts", ".tsx", ".md", ".mjs", ".css", ".mdx"];

/**
 * 데이터가 아직 안 만들어 낸 글자까지 최소한 덮는 안전분.
 * ASCII·Latin-1 전체 + 화면에 실제로 쓰는 구두점·기호. 라틴은 글리프가 단순해
 * 다 넣어도 몇 KB 밖에 안 늘고, 빠지면 영문 리그명에서 바로 티가 난다.
 */
const SAFETY = [
  ...range(0x20, 0x7e),
  ...range(0xa0, 0xff),
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026,
  0x00b7, 0x2032, 0x2033, 0x20a9, 0x20ac, 0x00a9, 0x00ae, 0x2122,
  0x2190, 0x2192, 0x2191, 0x2193, 0x25b2, 0x25bc, 0x25cf, 0x25a0,
  0x2605, 0x2606, 0x3000, 0x300c, 0x300d, 0x3008, 0x3009, 0xff08, 0xff09,
];

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

function collect() {
  const cps = new Set(SAFETY);
  for (const root of SCAN_ROOTS) {
    if (!fs.existsSync(root)) continue;
    walk(root, cps);
  }
  return cps;
}

function walk(dir, cps) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    // 폰트 디렉터리는 건너뛴다 — 바이너리를 텍스트로 읽으면 쓰레기 코드포인트가 섞인다.
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "fonts" || e.name === ".next") continue;
      walk(p, cps);
      continue;
    }
    if (!SCAN_EXT.includes(path.extname(e.name))) continue;
    let text;
    try {
      text = fs.readFileSync(p, "utf-8");
    } catch {
      continue;
    }
    for (const ch of text) {
      const o = ch.codePointAt(0);
      if (o >= 0x20 && o !== 0x7f) cps.add(o);
    }
  }
}

const cps = collect();
const hangul = [...cps].filter((o) => o >= 0xac00 && o <= 0xd7a3).length;
console.log(
  `[fonts:ui] 코드포인트 ${cps.size} (한글 음절 ${hangul} / 그 외 ${cps.size - hangul})`,
);

const unicodes = [...cps]
  .sort((a, b) => a - b)
  .map((o) => "U+" + o.toString(16).toUpperCase())
  .join(",");

let total = 0;
for (const [src, out] of SOURCES) {
  const from = path.join(OUT_DIR, src);
  const to = path.join(OUT_DIR, out);
  execFileSync(
    "pyftsubset",
    [from, `--unicodes=${unicodes}`, "--layout-features=*", "--flavor=woff2", `--output-file=${to}`],
    { stdio: "inherit" },
  );
  const after = fs.statSync(to).size;
  total += after;
  console.log(
    `[fonts:ui] ${src} ${(fs.statSync(from).size / 1024).toFixed(0)}KB → ${out} ${(after / 1024).toFixed(0)}KB`,
  );
}
console.log(`[fonts:ui] 합계 ${(total / 1024).toFixed(0)}KB`);
