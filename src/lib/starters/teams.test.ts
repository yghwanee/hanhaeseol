import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTeamName } from "./teams";

test("KBO 팀명은 그대로 통과", () => {
  assert.equal(normalizeTeamName("KIA"), "KIA");
  assert.equal(normalizeTeamName("롯데"), "롯데");
});

test("MLB 편성 풀네임과 네이버 축약이 같은 canonical로", () => {
  assert.equal(normalizeTeamName("샌디에이고 파드리스"), normalizeTeamName("샌디에이고"));
  assert.equal(normalizeTeamName("시카고 화이트삭스"), normalizeTeamName("시카고W"));
  assert.equal(normalizeTeamName("시카고 컵스"), normalizeTeamName("시카고컵스"));
  assert.notEqual(normalizeTeamName("시카고 컵스"), normalizeTeamName("시카고 화이트삭스"));
  assert.equal(normalizeTeamName("LA 다저스"), normalizeTeamName("LA다저스"));
  assert.notEqual(normalizeTeamName("LA 다저스"), normalizeTeamName("LA 에인절스"));
});

test("공백 차이 무시", () => {
  assert.equal(normalizeTeamName(" 보스턴 레드삭스 "), normalizeTeamName("보스턴"));
});

test("미지의 팀명은 trim만 해서 반환", () => {
  assert.equal(normalizeTeamName(" 알수없는팀 "), "알수없는팀");
});
