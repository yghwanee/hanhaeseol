import { test } from "node:test";
import assert from "node:assert/strict";
import { proxyLogo } from "./emblem";

test("ESPN 원본 로고는 축소본으로 바꾼다", () => {
  assert.equal(
    proxyLogo("https://a.espncdn.com/i/teamlogos/soccer/500/101.png"),
    "https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/101.png&w=160&h=160&transparent=true",
  );
  assert.match(proxyLogo("https://a.espncdn.com/i/teamlogos/nba/500/lal.png"), /combiner/);
});

test("다른 로고는 기존 경로를 지킨다", () => {
  assert.equal(proxyLogo("/logos/kbo/SS.webp"), "/logos/kbo/SS.webp");
  assert.match(proxyLogo("https://sports-phinf.pstatic.net/a.png"), /^\/api\/emblem\?u=/);
  // ESPN 의 다른 경로는 축소 경로가 받는 형식인지 모르니 건드리지 않는다.
  const other = "https://a.espncdn.com/i/flags/500/kor.png";
  assert.equal(proxyLogo(other), other);
});
