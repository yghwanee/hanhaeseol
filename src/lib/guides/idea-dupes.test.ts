import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseIdeas,
  parseContentPlan,
  toExistingGuides,
  findDuplicates,
  renderReport,
  slugTokens,
  titleTokens,
} from "./idea-dupes";

// 실제 이슈 #20(2026-07-19) 본문에서 발췌 — 형식이 바뀌면 여기서 깨져야 한다.
const ISSUE_BODY = `## 📅 예정 발행 일정 (날짜순)

- 2026-07-21 (화) — 오타니 쇼헤이 7월 LA 다저스 경기 [고정]

## 💡 이번 주 새 글감 10개

1. 🔴 이정후 트레이드 데드라인 D-12, 거취에 따라 중계 채널 달라진다 — 새 팀 가면 SPOTV·쿠팡 어디서 보나 (slug: lee-jeong-hoo-trade-deadline-broadcast-2026)
2. 라민 야말 계속 보려면 라리가다 — 바르셀로나 경기 쿠팡플레이로 보는 법 (slug: lamine-yamal-laliga-coupang-broadcast)
6. EPL 2026-27 개막 8월 22일 확정 — 쿠팡플레이 스포츠 패스 지금 가입하면 뭘 볼 수 있나 (slug: epl-2026-27-coupang-august-kickoff)
9. KBO 후반기 순위 경쟁 시작 — 티빙 무료 여부·요금 한 줄 정리 (slug: kbo-second-half-2026-tving-guide)
10. 슬러그가 없는 줄은 대조할 수 없으니 버린다
`;

const PLAN_MD = `# 한해설 Topic — 콘텐츠 큐

## ★ 메인 큐

- [x] 이강인 아틀레티코 이적 확정 (slug: lee-kang-in-atletico-laliga-broadcast)
- [ ] 이정후 MLB 경기 어디서 보나 — 샌프란시스코 자이언츠 중계·한국어 해설·시간 정리 (slug: jeong-hoo-lee-mlb-broadcast-2026)
- [ ] 김민재 분데스리가 2026-27 중계는 어디서 (slug: kim-min-jae-bundesliga-2026-27)

## 예비 (메인 큐가 비면 사람이 승격시킨다)

- [ ] EPL 2026-27 중계 어디서 보나 — 쿠팡플레이 독점, 요금·시청법 (slug: epl-2026-27-broadcast)
- [ ] 2026 KBO 중계 보는 법 — 티빙 독점(2031까지)·무료로 보는 법 (slug: kbo-2026-broadcast)
`;

test("parseIdeas: 번호 + slug 있는 줄만 뽑고 🔴 표시는 제목에서 뗀다", () => {
  const ideas = parseIdeas(ISSUE_BODY);
  assert.equal(ideas.length, 4);

  assert.equal(ideas[0].index, 1);
  assert.equal(ideas[0].slug, "lee-jeong-hoo-trade-deadline-broadcast-2026");
  assert.ok(ideas[0].title.startsWith("이정후 트레이드 데드라인"));
  assert.ok(!ideas[0].title.includes("🔴"));
  assert.ok(!ideas[0].title.includes("slug:"));

  // 📅 예정 발행 일정 섹션의 "- 2026-07-21 (화) ..." 줄은 글감이 아니다
  assert.ok(!ideas.some((i) => i.title.includes("오타니")));
});

test("parseContentPlan: 체크박스 줄을 섹션명과 함께 뽑고 발행 완료를 표시한다", () => {
  const items = parseContentPlan(PLAN_MD);
  assert.equal(items.length, 5);

  const done = items.find((i) => i.slug === "lee-kang-in-atletico-laliga-broadcast");
  assert.ok(done);
  assert.ok(done.source.includes("메인 큐"));
  assert.ok(done.source.includes("발행 완료"));

  const backlog = items.find((i) => i.slug === "epl-2026-27-broadcast");
  assert.ok(backlog);
  assert.ok(backlog.source.includes("예비"));
  assert.ok(!backlog.source.includes("발행 완료"));
});

test("slugTokens/titleTokens: 식별력 없는 토큰은 버린다", () => {
  // 연도·broadcast가 겹치는 건 근거가 아니다
  assert.deepEqual(slugTokens("epl-2026-27-broadcast"), ["epl"]);
  // 우리 글 제목에 늘 있는 말은 버린다
  assert.deepEqual(titleTokens("중계 어디서 보나 한국어 해설"), []);
  assert.ok(titleTokens("KBO 후반기 티빙 무료").includes("kbo"));
});

test("titleTokens: 토큰은 원형 유지, 날짜·숫자만 버린다", () => {
  // 고유명사를 깎으면 안 된다 — `쇼헤이` → `쇼헤`, `쿠팡플레이` → `쿠팡플레` 사고(2026-07-20)
  assert.ok(titleTokens("오타니 쇼헤이 쿠팡플레이").includes("쇼헤이"));
  assert.ok(titleTokens("오타니 쇼헤이 쿠팡플레이").includes("쿠팡플레이"));
  // 날짜·숫자는 주제를 가르지 못한다
  assert.deepEqual(titleTokens("7월 2026 8월"), []);
});

test("findDuplicates: 조사가 붙어도(무료 ↔ 무료로) 옳은 글에 붙는다", () => {
  const ideas = parseIdeas(
    "9. KBO 후반기 순위 경쟁 시작 — 티빙 무료 여부·요금 한 줄 정리 (slug: kbo-second-half-2026-tving-guide)",
  );
  const existing = parseContentPlan(`## 예비
- [ ] 2026 KBO 중계 보는 법 — 티빙 독점(2031까지)·무료로 보는 법 (slug: kbo-2026-broadcast)
- [x] 월드컵 3·4위전 — 단 한 경기, 채널·무료 여부·시청 팁 (slug: worldcup-third-place)
`);
  const matches = findDuplicates(ideas, existing);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].existing.slug, "kbo-2026-broadcast");
});

test("findDuplicates: 제목 단어만 겹친 글보다 slug가 겹친 글을 고른다", () => {
  const ideas = parseIdeas(
    "6. EPL 2026-27 개막 8월 22일 확정 — 쿠팡플레이 스포츠 패스 (slug: epl-2026-27-coupang-august-kickoff)",
  );
  const existing = parseContentPlan(`## ★ 메인 큐
- [x] 이강인 아틀레티코 이적 확정, 라리가 경기 어디서 보나 — 쿠팡플레이 라리가 중계 정리 (slug: lee-kang-in-atletico-laliga-broadcast)
- [ ] EPL 2026-27 중계 어디서 보나 — 쿠팡플레이 독점, 요금·시청법 (slug: epl-2026-27-broadcast)
`);
  const matches = findDuplicates(ideas, existing);
  // 이강인 글도 제목 단어(쿠팡플레이·확정)가 겹쳐 후보엔 들지만, 맨 앞은 slug가 겹친 EPL이어야 한다
  assert.equal(matches[0].existing.slug, "epl-2026-27-broadcast");
});

test("findDuplicates: slug가 같으면 exact", () => {
  const ideas = parseIdeas("1. 제목 (slug: kbo-2026-broadcast)");
  const matches = findDuplicates(ideas, parseContentPlan(PLAN_MD));
  assert.equal(matches.length, 1);
  assert.equal(matches[0].kind, "exact");
  assert.equal(matches[0].existing.slug, "kbo-2026-broadcast");
});

test("findDuplicates: 2026-07-19 실제 3건(이정후·EPL·KBO)을 모두 잡는다", () => {
  const matches = findDuplicates(parseIdeas(ISSUE_BODY), parseContentPlan(PLAN_MD));
  const byIdea = new Map(matches.map((m) => [m.idea.index, m]));

  // 이정후: slug 토큰 lee/jeong/hoo가 겹친다
  assert.equal(byIdea.get(1)?.existing.slug, "jeong-hoo-lee-mlb-broadcast-2026");
  // EPL: slug는 epl 하나뿐이라 제목(EPL·쿠팡플레이)으로 잡혀야 한다
  assert.equal(byIdea.get(6)?.existing.slug, "epl-2026-27-broadcast");
  // KBO: 제목의 kbo·티빙이 겹친다
  assert.equal(byIdea.get(9)?.existing.slug, "kbo-2026-broadcast");

  // 겹치지 않는 글감(라민 야말)은 걸리지 않는다
  assert.equal(byIdea.has(2), false);
});

test("findDuplicates: 글감 하나당 최대 2건까지만 남긴다", () => {
  const ideas = parseIdeas("1. 이정후 MLB 중계 (slug: lee-jeong-hoo-trade-deadline-broadcast-2026)");
  const matches = findDuplicates(ideas, parseContentPlan(PLAN_MD));
  assert.ok(matches.length >= 1);
  assert.ok(matches.length <= 2);
  // 가장 센 근거가 맨 앞
  assert.equal(matches[0].existing.slug, "jeong-hoo-lee-mlb-broadcast-2026");
});

test("findDuplicates: 발행글과도 대조한다", () => {
  const ideas = parseIdeas("1. KBO 올스타전 2026 티빙에서 보기 (slug: kbo-allstar-2026-tving)");
  const guides = toExistingGuides([
    { slug: "kbo-allstar-2026-broadcast", title: "KBO 올스타전 2026, 잠실 마지막 별들의 무대 어디서 보나" },
  ]);
  const matches = findDuplicates(ideas, guides);
  assert.equal(matches.length, 1);
  assert.ok(matches[0].existing.source.includes("발행글"));
});

test("renderReport: 겹침 없으면 빈 문자열", () => {
  assert.equal(renderReport([]), "");
  const report = renderReport(
    findDuplicates(parseIdeas(ISSUE_BODY), parseContentPlan(PLAN_MD)),
  );
  assert.ok(report.includes("🔴 중복") || report.includes("⚠️ 유사"));
  assert.ok(report.includes("epl-2026-27-broadcast"));
});
