import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DISCLOSURE_FULL,
  DISCLOSURE_SHORT,
  MAX_PICKS_PER_PLACEMENT,
  SAME_PAGE_SLOT_GROUPS,
  TOSS_SLOTS,
  slotKeys,
  PRICE_STALE_DAYS,
  isPriceStale,
  isExpired,
  formatWon,
  TOSS_PICKS_STORE,
  type TossPick,
} from "./toss-picks";
import { embedTossPicks, renderTossPickHtml } from "./embed";

/**
 * 토스 쉐어링크 **지면** 가드.
 *
 * `sharelink.test.ts` 가 자격증명 유출을 막는다면, 여기는 화면에 붙은 것이
 * 운영정책을 넘지 않는지 본다. 넘으면 수익 정지·계약 해지라 되돌릴 수가 없다.
 * 지키는 것 네 가지:
 *  ① 대가성 문구가 상품 소개와 같은 자리에 반드시 있다 (표시광고법)
 *  ② 상품 이미지를 쓰지 않는다 (사전 확인 전까지)
 *  ③ 나열·전시(커머스형)로 키우지 않는다
 *  ④ 플로팅 배너가 아니다 · 추적 링크(shortUrl)만 쓴다
 */

const EMBED = path.resolve("src/lib/affiliate/embed.ts");
const STRIP = path.resolve("src/app/_components/TossDealStrip.tsx");
const STORE_JSON = path.resolve("src/data/toss-picks.json");
/** 토스 상품이 실제로 그려지는 자리 전부. 지면을 늘리면 여기에 추가할 것. */
const PLACEMENTS = [EMBED, STRIP];

const read = (p: string) => fs.readFileSync(p, "utf8");

test("대가성 문구가 토스 문서 원문 그대로다", () => {
  // 문구를 줄이거나 바꾸면 안 된다. '#ad'·'제휴 링크'처럼 경제적 이해관계가 드러나지
  // 않는 표현만 쓰는 것을 정책이 명시적으로 금지한다.
  assert.ok(
    DISCLOSURE_FULL.includes("수수료를 지급받습니다"),
    "긴 문구에서 수수료 지급 사실이 빠졌다",
  );
  assert.ok(DISCLOSURE_SHORT.startsWith("[광고]"), "짧은 문구는 [광고] 로 시작해야 한다");
  assert.ok(
    DISCLOSURE_SHORT.includes("수수료를 지급받습니다"),
    "짧은 문구에도 수수료 지급 사실이 있어야 한다 — '[광고]' 만으로는 위반이다",
  );
});

test("모든 지면이 대가성 문구 상수를 쓴다", () => {
  for (const file of PLACEMENTS) {
    const src = read(file);
    assert.ok(
      /DISCLOSURE_(FULL|SHORT)/.test(src),
      `${path.basename(file)} 에 대가성 문구가 없다 — 상품 소개와 같은 자리에 반드시 붙는다`,
    );
  }
});

test("상품 이미지를 쓰지 않는다", () => {
  // 🔴 이미지 URL 을 외부 사이트에 직접 표시하는 것은 토스 고객센터 **사전 확인** 대상이다.
  // 확인을 받았다면 이 테스트를 지우는 게 아니라, 확인받은 범위를 주석으로 남기고 고칠 것.
  for (const file of PLACEMENTS) {
    const src = read(file);
    for (const banned of ["thumbnailUrl", "mainImageUrls", "detailImageUrls", "<img", "next/image"]) {
      assert.ok(
        !src.includes(banned),
        `${path.basename(file)} 가 상품 이미지를 쓴다 (${banned}) — 사전 확인 없이는 금지다`,
      );
    }
  }
  const store = read(STORE_JSON);
  for (const banned of ["thumbnail", "imageUrl", "mainImage"]) {
    assert.ok(!store.includes(banned), `toss-picks.json 에 이미지 필드가 들어갔다 (${banned})`);
  }
});

test("추적 안 되는 productUrl 을 쓰지 않는다", () => {
  for (const file of [...PLACEMENTS, STORE_JSON]) {
    assert.ok(
      !read(file).includes("productUrl"),
      `${path.basename(file)} 가 productUrl 을 쓴다 — 추적이 안 붙어 수익이 안 잡힌다. shortUrl 을 쓸 것`,
    );
  }
});

test("제휴 링크에 rel sponsored 와 새 탭이 붙는다", () => {
  for (const file of PLACEMENTS) {
    const src = read(file);
    assert.ok(
      /rel=["'][^"']*sponsored/.test(src),
      `${path.basename(file)} 의 링크에 rel="sponsored" 가 없다 — 유료 링크 미표시는 검색 가이드라인 위반이다`,
    );
    assert.ok(/noopener/.test(src), `${path.basename(file)} 의 새 탭 링크에 noopener 가 없다`);
  }
});

test("플로팅 배너가 아니다", () => {
  // 본문을 가리며 따라다니는 형태는 정책이 전면 금지한다.
  for (const file of PLACEMENTS) {
    const src = read(file);
    assert.ok(
      !/\b(fixed|sticky)\b/.test(src.replace(/^\s*\*.*$/gm, "")),
      `${path.basename(file)} 가 fixed/sticky 를 쓴다 — 플로팅 광고는 금지다`,
    );
  }
});

test("한 지면에 한 상품만 — 나열·전시로 키우지 않는다", () => {
  // "API 로 받은 가격을 쌓아 이커머스처럼 나열·전시하는 커머스형 웹사이트는 승인되지
  // 않습니다"(운영정책). 상한을 올리려면 그 문장을 먼저 다시 읽을 것.
  assert.equal(MAX_PICKS_PER_PLACEMENT, 1);
  assert.ok(TOSS_SLOTS.length <= 3, "자리를 늘릴 때마다 나열·전시에 가까워진다 — 정책 문장을 먼저 다시 읽을 것");
  assert.ok(
    !/\.map\(/.test(read(STRIP)),
    "홈 띠가 상품 목록을 map 으로 그린다 — 한 개만 건다",
  );
});

test("같은 화면의 두 자리에 같은 상품을 걸지 않는다", () => {
  // home-top 과 home-inline 은 홈 한 장에 같이 뜬다. 같은 상품이면 사람은 광고 도배로 읽는다.
  const keys = slotKeys();
  for (const group of SAME_PAGE_SLOT_GROUPS) {
    const used = group.map((s) => keys[s]).filter(Boolean);
    assert.equal(
      new Set(used).size,
      used.length,
      `같은 화면(${group.join(" + ")})에 같은 상품이 두 번 걸렸다: ${used.join(", ")}`,
    );
  }
});

test("자리에 걸린 키가 실제로 저장돼 있다", () => {
  const keys = slotKeys();
  for (const slot of TOSS_SLOTS) {
    const key = keys[slot];
    if (!key) continue;
    assert.ok(
      TOSS_PICKS_STORE.picks[key],
      `'${slot}' 자리가 없는 상품 '${key}' 를 가리킨다 — 그 자리는 조용히 비어 버린다`,
    );
  }
});

test("가격은 확인한 지 오래되면 숨긴다", () => {
  assert.equal(PRICE_STALE_DAYS, 14);
  assert.equal(isPriceStale("2026-09-14", "2026-09-14"), false);
  assert.equal(isPriceStale("2026-08-31", "2026-09-14"), false, "정확히 14일은 아직 유효");
  assert.equal(isPriceStale("2026-08-30", "2026-09-14"), true, "15일이면 낡음");
  assert.equal(isPriceStale("", "2026-09-14"), true, "날짜가 없으면 안전한 쪽(낡음)");
  assert.equal(isPriceStale("어제", "2026-09-14"), true, "형식이 깨지면 안전한 쪽(낡음)");
});

test("마감된 하루특가는 지면에서 빠진다", () => {
  const base: TossPick = {
    tacaItemId: 1,
    displayName: "예시",
    displayPrice: 1000,
    originalPrice: 2000,
    discountRate: 50,
    shortUrl: "https://toss.im/x",
    checkedAt: "2026-09-14",
  };
  const now = new Date("2026-09-14T12:00:00Z");
  assert.equal(isExpired(base, now), false, "endAt 이 없으면 상시 상품");
  assert.equal(isExpired({ ...base, endAt: "2026-09-14T11:00:00Z" }, now), true);
  assert.equal(isExpired({ ...base, endAt: "2026-09-14T13:00:00Z" }, now), false);
});

test("없는 상품 마커는 본문에 흔적을 남기지 않는다", () => {
  // 키를 지웠는데 마커가 그대로 남으면 독자가 ':::toss foo:::' 를 읽게 된다.
  const html = embedTossPicks("<p>앞</p>\n<p>:::toss gone-key:::</p>\n<p>뒤</p>");
  assert.ok(!html.includes(":::toss"), "마커가 본문에 남았다");
  assert.ok(html.includes("앞") && html.includes("뒤"), "주변 본문이 사라졌다");
  assert.equal(renderTossPickHtml("gone-key"), "");
  // 키 형식이 틀린 것(오타·한글)도 지워져야 한다 — 패턴에 안 걸리면 독자가 마커를 읽는다.
  assert.ok(
    !embedTossPicks("<p>:::toss 없는키:::</p>").includes(":::toss"),
    "형식이 틀린 마커가 본문에 남았다",
  );
});

test("저장된 상품 데이터가 규격에 맞는다", () => {
  const store = TOSS_PICKS_STORE;
  assert.ok(store.picks && typeof store.picks === "object", "picks 가 없다");
  for (const [key, pick] of Object.entries(store.picks)) {
    assert.ok(/^[a-z0-9][a-z0-9-]*$/.test(key), `키가 마커에 못 들어가는 형식이다: ${key}`);
    assert.equal(typeof pick.tacaItemId, "number", `${key}: tacaItemId`);
    assert.ok(pick.displayName?.length > 0, `${key}: displayName 이 비었다`);
    assert.ok(Number.isFinite(pick.displayPrice), `${key}: displayPrice`);
    assert.ok(
      /^https:\/\//.test(pick.shortUrl),
      `${key}: shortUrl 이 https 가 아니다 — /openapi/links 로 받은 값을 넣을 것`,
    );
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(pick.checkedAt), `${key}: checkedAt 형식이 아니다`);
  }
  if (store.deal) {
    assert.ok(store.picks[store.deal], `deal 이 없는 키를 가리킨다: ${store.deal}`);
  }
});

test("가격 표기는 원화 서식을 쓴다", () => {
  assert.equal(formatWon(8400), "8,400원");
  assert.equal(formatWon(0), "0원");
});
