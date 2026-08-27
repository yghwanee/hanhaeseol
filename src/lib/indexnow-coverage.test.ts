import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUrlList } from "@/scripts/indexnow-ping";
import sitemap from "@/app/sitemap";
import fs from "node:fs";
import path from "node:path";

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

test("robots.txt 가 막은 경로를 통지하지 않는다", () => {
  // 🔴 2026-08-24 에 매치 URL 을 sitemap(INCLUDE_MATCH_URLS=false)과 robots(Disallow: /match/)
  // 에서 뺐는데 통지 목록만 그대로 남아, **크롤 금지 URL 을 계속 ping** 하고 있었다.
  // 종전 가드는 반대로 "매치가 들어 있어야 한다"고 검사해서 8/24 부터 CI 가 빨간 채였다.
  //
  // 이제 특정 경로를 박아 두지 않고 robots.txt 를 읽어 대조한다 — 나중에 결정이
  // 뒤집혀도(매치를 다시 열어도) 가드가 따라오고, 새로 막는 경로가 생겨도 자동으로 걸린다.
  const robots = fs.readFileSync(path.resolve("public/robots.txt"), "utf8");
  const globalBlock = robots.split(/User-agent:/i)[1] ?? "";
  const disallowed = [...globalBlock.matchAll(/^\s*Disallow:\s*(\S+)\s*$/gim)]
    .map((m) => m[1])
    .filter((p) => p !== "/");
  assert.ok(disallowed.length > 0, "robots.txt 에서 Disallow 를 못 읽었다 — 파서 확인");

  const violations = urls.filter((u) => {
    const pathname = decodeURIComponent(new URL(u).pathname);
    return disallowed.some((d) => pathname.startsWith(d));
  });
  assert.deepEqual(
    violations,
    [],
    `robots.txt 가 막은 경로를 통지하고 있다 ${violations.length}건 — ` +
      "sitemap·robots·IndexNow 셋은 같은 신호를 내야 한다",
  );
});

test("IndexNow quota(호스트당 약 10,000/일) 안에 있다", () => {
  assert.ok(urls.length < 5000, `통지 URL ${urls.length}건 — quota 위험`);
});
