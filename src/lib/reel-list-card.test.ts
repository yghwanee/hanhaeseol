import { test } from "node:test";
import assert from "node:assert/strict";
import { buildListRows, LIST_MAX_CARDS, LIST_PER_CARD, renderReelListCards } from "./reel-list-card";
import { getKstToday, loadKoreanMatchesAll, registerFonts } from "./instagram";

// 🔴 날짜를 박지 않는다 — schedule.json 은 오늘부터 7일치다.
const DATES = Array.from({ length: 7 }, (_, i) => getKstToday(i).today);

test("목록은 카드 상한을 넘지 않고 시각순이다", () => {
  for (const d of DATES) {
    const { rows } = buildListRows(d);
    assert.ok(rows.length <= LIST_PER_CARD * LIST_MAX_CARDS, `${d}: ${rows.length}줄`);
    const times = rows.map((r) => r.time);
    assert.deepEqual(times, [...times].sort(), `${d}: 시각순이 아니다`);
  }
});

test("🔴 같은 경기가 두 줄로 나오지 않는다(플랫폼별 중복 접기)", () => {
  // KBO 는 티빙 + 케이블로 같은 경기가 두 줄씩 들어 있다. 접지 않으면 다섯 줄 중
  // 두세 줄이 같은 경기다.
  for (const d of DATES) {
    const { rows, total, listings } = buildListRows(d);
    const keys = rows.map((r) => `${r.league}|${r.matchup}`);
    assert.equal(new Set(keys).size, keys.length, `${d}: 중복 — ${keys}`);
    assert.ok(total <= listings, `${d}: 접은 수(${total})가 원본(${listings})보다 많다`);
    assert.equal(listings, loadKoreanMatchesAll(d).length);
  }
});

test("히어로는 목록에 한 줄만 표시된다", () => {
  for (const d of DATES) {
    const { rows } = buildListRows(d);
    if (rows.length === 0) continue;
    assert.ok(rows.filter((r) => r.isHero).length <= 1, `${d}: 히어로 표시가 둘 이상`);
  }
});

test("카드는 1080x1920 PNG 이고 경기가 없으면 한 장도 안 만든다", () => {
  registerFonts();
  for (const d of DATES) {
    const cards = renderReelListCards(d, { accent: "#8fff3d" });
    const { rows } = buildListRows(d);
    assert.equal(cards.length, Math.ceil(rows.length / LIST_PER_CARD), d);
    for (const buf of cards) {
      // PNG IHDR: 폭·높이가 16~23 바이트에 big-endian 으로 들어 있다.
      assert.equal(buf.readUInt32BE(16), 1080);
      assert.equal(buf.readUInt32BE(20), 1920);
    }
  }
  assert.equal(renderReelListCards("2099-01-01", { accent: "#8fff3d" }).length, 0);
});
