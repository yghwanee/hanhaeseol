import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { requiredGlyphChars } from "../scripts/_ebook-font-chars.mjs";

/**
 * ebook 배너 폰트 서브셋 가드.
 *
 * 🔴 왜 있는가: `layout.tsx` 는 Pretendard 원본 OTF(각 1.5MB) 대신 **서브셋 woff2**(각 58KB)를
 * 건다. 배너 인용구가 바뀌거나 배너 문구를 고쳤는데 서브셋을 다시 굽지 않으면 그 글자가
 * **두부(빈 네모)** 로 뜬다. 화면을 열어 보지 않으면 아무도 모르고, 하필 홈 최상단이다.
 *
 * 실패하면: `npm run fonts:subset` (pyftsubset 필요 — `pip install fonttools brotli`)
 */

const FONTS = [
  "public/fonts/Pretendard-Regular.subset.woff2",
  "public/fonts/Pretendard-Bold.subset.woff2",
];

/**
 * woff2 는 압축돼 있어 cmap 을 직접 못 읽는다. 대신 서브셋을 만든 글자 집합을
 * 파일 옆에 기록해 두고 그걸 대조한다 — 생성기와 가드가 같은 함수를 쓰므로,
 * 어긋나는 경우는 "서브셋을 다시 굽지 않았다" 하나뿐이고 그게 정확히 잡고 싶은 것이다.
 */
const MANIFEST = "public/fonts/subset-chars.json";

test("서브셋 폰트 파일이 존재하고 원본보다 훨씬 작다", () => {
  for (const f of FONTS) {
    const p = path.resolve(f);
    assert.ok(fs.existsSync(p), `없음: ${f} — npm run fonts:subset`);
    const kb = fs.statSync(p).size / 1024;
    assert.ok(kb < 400, `${f} 가 ${kb.toFixed(0)}KB — 서브셋이 아닌 것 같다`);
  }
});

test("배너가 그릴 수 있는 글자가 전부 서브셋에 들어 있다", () => {
  const manifestPath = path.resolve(MANIFEST);
  assert.ok(fs.existsSync(manifestPath), `없음: ${MANIFEST} — npm run fonts:subset`);
  const baked: string[] = JSON.parse(fs.readFileSync(manifestPath, "utf8")).chars;
  const have = new Set(baked);
  const need = requiredGlyphChars();
  const missing = [...need].filter((c) => !have.has(c));
  assert.deepEqual(
    missing,
    [],
    `서브셋에 없는 글자 ${missing.length}개: ${missing.join("")}\n  → npm run fonts:subset 으로 다시 구울 것`,
  );
});

test("layout.tsx 가 원본 OTF 를 웹 폰트로 걸지 않는다", () => {
  const layout = fs.readFileSync(path.resolve("src/app/layout.tsx"), "utf8");
  const face = layout.match(/localFont\(\{[\s\S]*?\}\)/g) ?? [];
  const pretendard = face.filter((f) => f.includes("Pretendard"));
  assert.ok(pretendard.length > 0, "Pretendard localFont 선언을 못 찾았다");
  for (const f of pretendard) {
    assert.ok(
      !/Pretendard-(Regular|Bold)\.otf/.test(f),
      "원본 OTF(1.5MB)가 브라우저로 나간다 — 서브셋 woff2 를 쓸 것",
    );
  }
});
