/**
 * 편성에 들어온 리그가 결과·라이브 스코어를 받을 수 있는지 지키는 가드.
 *
 * 배경(2026-08-11): "클럽 친선경기"·"FA 커뮤니티 실드"·"UEFA 슈퍼컵" 은 네이버에
 * categoryId 가 있는데 LEAGUE_TO_CATEGORY 에만 없어서, 편성표엔 뜨는데 스코어는
 * 영영 안 붙는 상태였다. 새 리그가 편성에 들어오는 건 크롤러 몫이라 사람이 표를
 * 갱신하지 않으면 조용히 같은 일이 반복된다.
 *
 * 그래서 "매핑이 있다"가 아니라 **"매핑이 있거나, 없다고 명시돼 있다"** 를 검사한다.
 * 네이버가 아예 커버하지 않는 대회(리그컵=Leagues Cup, WNBA 등)는 아래 목록에 적어
 * 두고, 목록에도 표에도 없는 리그가 나타나면 실패시킨다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import scheduleData from "@/data/schedule.json";
import { categoriesForLeague, LEAGUE_TO_CATEGORY } from "./lookup";
import { LEAGUES } from "./naver";
import type { ScheduleData } from "@/types/schedule";

/**
 * 네이버 스포츠에 대응 categoryId 가 없다고 확인한 대회(2026-08-11 실측).
 * 후보 id 를 여러 개 던져 전부 400 을 받은 것들이라, 여기 있는 동안은 스코어가 안 붙는 게 정상이다.
 * 네이버가 나중에 카테고리를 열면 이 목록에서 빼고 LEAGUE_TO_CATEGORY 에 넣으면 된다.
 */
const KNOWN_UNSUPPORTED = new Set([
  "리그컵", // Leagues Cup (MLS x 리가 MX)
  "WNBA",
  "아세안 현대 컵",
  "분데스리가 2",
  "트로페 데 샹피옹",
  "V리그",
]);

const schedules = (scheduleData as unknown as ScheduleData).schedules;

test("편성에 있는 모든 리그는 매핑이 있거나 미지원으로 명시돼 있다", () => {
  const leagues = [...new Set(schedules.map((s) => s.league))].sort();
  const unhandled = leagues.filter(
    (lg) => categoriesForLeague(lg).length === 0 && !KNOWN_UNSUPPORTED.has(lg),
  );
  assert.deepEqual(
    unhandled,
    [],
    `결과/라이브 스코어가 안 붙는 리그: ${unhandled.join(", ")}\n` +
      "→ 네이버 categoryId 를 찾아 LEAGUE_TO_CATEGORY 에 넣거나, 없으면 KNOWN_UNSUPPORTED 에 적을 것.",
  );
});

test("미지원 목록은 실제 편성에 있는 리그만 담는다", () => {
  // 대회가 끝나 편성에서 사라진 항목이 남아 있으면, 나중에 같은 이름으로 돌아와도
  // 가드가 조용히 통과해 버린다(가드가 가드 노릇을 못 하게 되는 경로).
  const leagues = new Set(schedules.map((s) => s.league));
  const stale = [...KNOWN_UNSUPPORTED].filter(
    (lg) => !leagues.has(lg) && !LEAGUE_TO_CATEGORY[lg],
  );
  // 시즌 오프인 대회도 있으므로 경고 수준으로만 — 목록 전체가 죽는 경우만 잡는다.
  assert.ok(
    stale.length < KNOWN_UNSUPPORTED.size,
    `미지원 목록이 통째로 편성과 무관해졌다: ${stale.join(", ")}`,
  );
});

test("매핑된 categoryId 는 전부 실제 크롤 대상이다", () => {
  // 표에만 넣고 크롤 목록(LEAGUES)에 안 넣으면 byKey 에 그 리그 결과가 아예 안 담긴다.
  const crawled = new Set(LEAGUES.map((l) => l.categoryId));
  const mapped = new Set(
    Object.values(LEAGUE_TO_CATEGORY).flatMap((c) => (Array.isArray(c) ? c : [c])),
  );
  const uncrawled = [...mapped].filter((c) => !crawled.has(c));
  assert.deepEqual(uncrawled, [], `크롤 목록에 없는 categoryId: ${uncrawled.join(", ")}`);
});

test("2026-08-11 에 뚫은 세 리그는 매핑이 유지된다", () => {
  // 되돌아가면 클럽 친선·슈퍼컵 스코어가 다시 사라진다.
  assert.deepEqual(categoriesForLeague("클럽 친선경기"), ["clubfriendly"]);
  assert.deepEqual(categoriesForLeague("FA 커뮤니티 실드"), ["communityshield"]);
  assert.deepEqual(categoriesForLeague("UEFA 슈퍼컵"), ["uefasupercup"]);
});
