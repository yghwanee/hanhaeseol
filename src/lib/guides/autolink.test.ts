import { test } from "node:test";
import assert from "node:assert/strict";
import { autolinkGuideBody, buildEntities, relativizeSelfLinks } from "./autolink";

test("리그·플랫폼 이름을 첫 등장에만 링크한다", () => {
  const md = "티빙에서 KBO를 본다. 티빙은 편하다. 티빙 좋다.";
  const out = autolinkGuideBody(md);
  assert.equal((out.match(/\/platform\/tving/g) ?? []).length, 1, out);
  assert.ok(out.includes("[티빙](/platform/tving)"), out);
});

test("최대 링크 수를 넘지 않는다", () => {
  const md = "티빙 쿠팡플레이 SPOTV NOW Apple TV+ SBS Sports tvN SPORTS 프리미어리그 라리가";
  const out = autolinkGuideBody(md, 3);
  assert.equal((out.match(/\]\(\//g) ?? []).length, 3, out);
});

test("코드 펜스·인라인 코드는 건드리지 않는다", () => {
  const md = "```\n티빙 설정\n```\n그리고 `티빙` 은 코드다.\n본문에서 티빙을 쓴다.";
  const out = autolinkGuideBody(md);
  assert.ok(out.includes("```\n티빙 설정\n```"), out);
  assert.ok(out.includes("`티빙`"), out);
  // 보호 구간 밖의 첫 등장만 링크된다.
  assert.equal((out.match(/\/platform\/tving/g) ?? []).length, 1, out);
});

test("이미 있는 링크와 이미지는 건드리지 않는다", () => {
  const md = "[티빙 공식](https://tving.com) 을 보라. 그리고 티빙 편성표.";
  const out = autolinkGuideBody(md);
  assert.ok(out.includes("[티빙 공식](https://tving.com)"), out);
});

test("같은 목적지로 가는 링크가 이미 있으면 추가하지 않는다", () => {
  const md = "[여기](/platform/tving) 를 보라. 티빙은 좋다.";
  const out = autolinkGuideBody(md);
  assert.equal((out.match(/\/platform\/tving/g) ?? []).length, 1, out);
});

test("헤딩은 건드리지 않는다", () => {
  const md = "## 티빙으로 보는 법\n\n본문에서 쿠팡플레이를 쓴다.";
  const out = autolinkGuideBody(md);
  assert.ok(out.includes("## 티빙으로 보는 법"), out);
  assert.ok(out.includes("[쿠팡플레이](/platform/coupang-play)"), out);
});

test("긴 이름을 먼저 매칭한다 (K리그2가 K리그로 잘리지 않음)", () => {
  const ents = buildEntities();
  const names = ents.map((e) => e.name);
  const i2 = names.findIndex((n) => n === "K리그2");
  const i1 = names.findIndex((n) => n === "K리그");
  if (i2 >= 0 && i1 >= 0) assert.ok(i2 < i1, `K리그2(${i2})가 K리그(${i1})보다 먼저여야 한다`);
  const out = autolinkGuideBody("K리그2 경기를 본다.");
  assert.ok(out.includes("[K리그2](/league/k-league-2)"), out);
});

test("다른 단어의 일부는 링크하지 않는다", () => {
  // "티빙" 이 더 긴 한글 단어 안에 들어간 경우.
  const out = autolinkGuideBody("티빙키드라는 말이 있다.");
  assert.ok(!out.includes("]("), out);
});

test("정규식 특수문자가 든 이름도 처리한다", () => {
  // MBC SPORTS+ 의 `+` 가 이스케이프되지 않으면 정규식이 깨진다.
  const out = autolinkGuideBody("MBC SPORTS+ 에서 중계한다.");
  assert.ok(out.includes("]("), out);
  assert.ok(out.includes("MBC SPORTS+"), out);
});

test("링크할 게 없으면 원문을 그대로 돌려준다", () => {
  const md = "아무 리그도 플랫폼도 언급하지 않는 문장이다.";
  assert.equal(autolinkGuideBody(md), md);
});

test("보호 구간 복원이 원문을 훼손하지 않는다", () => {
  const md = "```js\nconst a = 1;\n```\n\n## 제목\n\n[링크](/x) 그리고 평범한 문장.";
  const out = autolinkGuideBody(md);
  assert.ok(out.includes("```js\nconst a = 1;\n```"), out);
  assert.ok(out.includes("## 제목"), out);
  assert.ok(out.includes("[링크](/x)"), out);
});

test("자기 사이트 절대 URL을 상대 경로로 바꾼다", () => {
  assert.equal(
    relativizeSelfLinks("[월드컵 페이지](https://haeseol.com/worldcup) 참고"),
    "[월드컵 페이지](/worldcup) 참고",
  );
  assert.equal(relativizeSelfLinks("[홈](https://haeseol.com)"), "[홈](/)");
  assert.equal(relativizeSelfLinks("[홈](https://www.haeseol.com/faq)"), "[홈](/faq)");
});

test("외부 링크는 건드리지 않는다", () => {
  const md = "[티빙](https://tving.com) 과 [네이버](https://sports.naver.com)";
  assert.equal(relativizeSelfLinks(md), md);
});

test("절대 자기링크가 있으면 같은 목적지를 중복 링크하지 않는다", () => {
  // 정규화가 먼저 돌아야 `(${href})` 중복 검사가 성립한다.
  const out = autolinkGuideBody("[월드컵 페이지](https://haeseol.com/worldcup) 그리고 월드컵 이야기.");
  assert.equal((out.match(/\/worldcup/g) ?? []).length, 1, out);
});
