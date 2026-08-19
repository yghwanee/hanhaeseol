import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUrlList } from "@/scripts/indexnow-ping";
import sitemap from "@/app/sitemap";

/**
 * IndexNow 통지 목록 ↔ 사이트맵 일치 가드.
 *
 * 존재하지 않거나 noindex 인 URL 을 ping 하면 크롤러가 404·noindex 를 받고
 * 호스트 신뢰도가 깎인다. 그래서 통지 목록은 **사이트맵의 부분집합**이어야 한다.
 *
 * 2026-08-19: 매치 페이지가 통지 목록에서 통째로 빠져 있었다(주석에 "추후 추가
 * 예정"으로 남아 있던 항목). GA4 28일 실측 Bing 171세션 / Google 66세션 —
 * 빙이 구글의 2.6배인데 빙이 실제로 쓰는 신호가 IndexNow 다.
 */

const urls = buildUrlList();
const sitemapUrls = new Set(sitemap().map((e) => e.url.replace(/\/$/, "")));

test("IndexNow 통지 URL 이 전부 사이트맵에 있다", () => {
  const orphans = urls
    .map((u) => u.replace(/\/$/, ""))
    .filter((u) => !sitemapUrls.has(u));
  assert.deepEqual(orphans, [], `사이트맵에 없는 통지 URL ${orphans.length}건`);
});

test("매치 페이지가 통지 목록에 들어 있다", () => {
  const matches = urls.filter((u) => u.includes("/match/"));
  assert.ok(matches.length > 0, "매치 URL 이 0건 — 통지 목록에서 빠졌다");
});

test("IndexNow quota(호스트당 약 10,000/일) 안에 있다", () => {
  assert.ok(urls.length < 5000, `통지 URL ${urls.length}건 — quota 위험`);
});
