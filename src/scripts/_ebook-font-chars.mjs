/**
 * ebook 배너가 그릴 수 있는 글자 집합.
 * 서브셋 생성기(`subset-pretendard.mjs`)와 가드 테스트(`ebook-font.test.ts`)가
 * **같은 함수**를 써야 둘이 어긋나지 않는다.
 *
 * 대상 = 인용구 원본(`ebook-quotes.json`) + 배너 컴포넌트 파일에 등장하는 모든
 * 한글/기호. 컴포넌트 파일은 주석까지 통째로 넣는다 — 몇백 글자 더 넣어도 용량은
 * 미미하고, 그 대신 "배너 문구를 고쳤는데 서브셋을 안 만들어 두부(tofu)가 뜨는" 사고를
 * 구조적으로 막을 수 있다.
 */
import fs from "node:fs";
import path from "node:path";

const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)).join("");
// 한국어 본문에서 흔한 기호 — 배너 문구가 바뀌어도 자주 쓰이는 것은 미리 넣어 둔다.
const PUNCT = "·—–…‘’“”「」『』〈〉《》×÷±°※→←↑↓○●△▲□■☆★♥♡€£¥₩©®™";

export function requiredGlyphChars() {
  const quotes = JSON.parse(fs.readFileSync(path.resolve("src/data/ebook-quotes.json"), "utf8"));
  const component = fs.readFileSync(path.resolve("src/app/_components/EbookBanner.tsx"), "utf8");
  const set = new Set([...ASCII, ...PUNCT]);
  for (const q of quotes) for (const ch of String(q)) if (ch.trim()) set.add(ch);
  for (const ch of component) {
    // 한글 음절/자모 + 한글 관련 문장부호만 추린다(코드에 섞인 라틴은 ASCII 로 이미 커버).
    if (/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(ch)) set.add(ch);
  }
  return set;
}
