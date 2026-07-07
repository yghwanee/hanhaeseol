import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type YtSearchItem,
  pickChannelScoped,
  pickGeneric,
  titleMentionsTeam,
  highlightChannelFor,
} from "./youtube";

function item(videoId: string, title: string): YtSearchItem {
  return { id: { videoId }, snippet: { title } };
}

test("titleMentionsTeam: 풀네임의 일부 토큰으로도 매칭", () => {
  assert.equal(titleMentionsTeam("[MLB] 양키스 vs 레이스 H/L", "뉴욕 양키스"), true);
  assert.equal(titleMentionsTeam("두산 8:2 LG 하이라이트", "두산"), true);
  assert.equal(titleMentionsTeam("케이티 위즈 매직", "삼성"), false);
});

test("pickChannelScoped: 하이라이트 제목 + 팀 언급 있어야 채택", () => {
  const items = [
    item("v1", "포르투갈 vs 스페인 프리뷰"), // 하이라이트 아님
    item("v2", "[하이라이트] 포르투갈 1-0 스페인"),
  ];
  assert.equal(pickChannelScoped(items, "포르투갈", "스페인"), "v2");
});

test("pickChannelScoped: 팬 클립처럼 팀 언급 없으면 null (재시도 유도)", () => {
  const items = [item("v1", "오늘의 명장면 하이라이트 모음")];
  assert.equal(pickChannelScoped(items, "두산", "LG"), null);
});

test("pickChannelScoped: 한 팀만 언급된 타 종목/타 경기 영상은 거부", () => {
  // 실측 사례: 월드컵 "브라질 vs 노르웨이"에 2019 핸드볼 영상이 잡혔던 케이스
  const items = [item("v1", "[다시보는 2019 세계 여자 핸드볼] 대한민국 VS 브라질 하이라이트")];
  assert.equal(pickChannelScoped(items, "브라질", "노르웨이"), null);
});

test("pickChannelScoped: 업로드 전(결과 없음)이면 null", () => {
  assert.equal(pickChannelScoped([], "두산", "LG"), null);
});

test("pickChannelScoped: H/L 표기도 하이라이트로 인정", () => {
  const items = [item("v9", "7.07 | 두산 vs LG | H/L")];
  assert.equal(pickChannelScoped(items, "두산", "LG"), "v9");
});

test("pickGeneric: 하이라이트 제목만 요구, 첫 결과 무조건 채택은 안 함", () => {
  assert.equal(pickGeneric([item("v1", "경기 전 인터뷰")]), null);
  assert.equal(
    pickGeneric([item("v1", "경기 전 인터뷰"), item("v2", "EPL Highlights: 첼시 vs 아스널")]),
    "v2",
  );
});

test("highlightChannelFor: KBO/월드컵/MLB 매핑, 그 외 undefined", () => {
  assert.equal(typeof highlightChannelFor("kbo"), "string");
  assert.equal(typeof highlightChannelFor("worldcup"), "string");
  assert.equal(typeof highlightChannelFor("mlb"), "string");
  assert.equal(highlightChannelFor("epl"), undefined);
});
