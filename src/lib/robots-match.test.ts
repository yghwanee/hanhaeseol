import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * `/match/` 를 **어느 봇에게 열었는지** 잠그는 가드 (2026-09-16 재판정).
 *
 * 배경 — 2026-08-24 에 전 봇에서 막았다. 근거 둘 중 비용(ISR Writes 96%, Active CPU 최상위)은
 * 여전히 유효하지만, "색인 가치 0" 은 **GSC = 구글** 결론이었다. 우리 유입의 81%는 네이버고
 * 2026-09-07 AEO 측정에서 네이버 AI 브리핑이 인용한 페이지가 전부 `/match/` 였다.
 * 그래서 네이버(Yeti)와 AI 답변 봇에만 열고 구글·빙·전역은 막은 채로 둔다.
 *
 * 🔴 이 가드가 막는 것은 **한쪽만 움직이는 것**이다. 세 신호(robots · 사이트맵 포함 ·
 * IndexNow 통지)가 따로 놀면 같은 URL 에 서로 다른 말을 하고, 2026-08-27 에 실제로
 * 그렇게 갈라져 있었다(robots 가 막은 URL 을 IndexNow 가 계속 ping).
 *
 * 🔴 비용 상한이 같이 살아 있는지도 본다. 열어 두고 상한이 빠지면
 * Active CPU 최상위였던 매치 OG satori 렌더가 아카이브 3,166건에 대해 되살아난다.
 */

const robots = readFileSync("public/robots.txt", "utf8");

/** 주석은 빼고 본다 — 이 변경을 **설명하는** 주석이 위반으로 잡히면 안 된다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** `/match/` 차단을 유지해야 하는 봇. 전역과 일반 검색엔진. */
const MUST_BLOCK = ["*", "Googlebot", "bingbot", "Daumoa"];

/** `/match/` 를 열어 둔 봇. 최소한 이 둘은 열려 있어야 재판정의 의미가 있다. */
const MUST_ALLOW = ["Yeti", "GPTBot"];

type Block = { agent: string; disallow: string[] };

function blocks(): Block[] {
  return robots
    .split(/^User-agent:\s*/m)
    .slice(1)
    .map((b) => ({
      agent: b.split("\n")[0].trim(),
      disallow: [...b.matchAll(/^Disallow:\s*(\S+)\s*$/gm)].map((m) => m[1]),
    }));
}

test("전역·구글·빙·다음은 /match/ 를 계속 막는다", () => {
  const all = blocks();
  assert.ok(all.length > 20, `robots 블록을 못 읽었다(${all.length}) — 파서 확인`);

  for (const agent of MUST_BLOCK) {
    const b = all.find((x) => x.agent === agent);
    assert.ok(b, `robots.txt 에 User-agent: ${agent} 블록이 없다`);
    assert.ok(
      b!.disallow.includes("/match/"),
      `${agent} 이 /match/ 를 크롤할 수 있다. 구글에서 매치 페이지의 색인 가치는 GSC 3개월 ` +
        `전수 실측 0 이었고(노출 0·클릭 0, 작업58), 비용은 ISR Writes 의 96% 였다.`,
    );
  }
});

test("네이버와 AI 답변 봇에는 /match/ 가 열려 있다", () => {
  const all = blocks();
  for (const agent of MUST_ALLOW) {
    const b = all.find((x) => x.agent === agent);
    assert.ok(b, `robots.txt 에 User-agent: ${agent} 블록이 없다`);
    assert.ok(
      !b!.disallow.includes("/match/"),
      `${agent} 이 /match/ 를 못 읽는다. 유입 81%가 네이버이고 AI 브리핑 인용이 전부 ` +
        `/match/ 였다(2026-09-07). 되돌리려면 robots.txt 의 재판정 주석부터 읽을 것.`,
    );
  }
});

test("열어 준 봇도 관리·단축 경로는 계속 막힌다", () => {
  // /match/ 만 골라 열었는지 확인한다. 블록을 통째로 비우면 /admin 까지 열린다.
  for (const b of blocks()) {
    for (const path of ["/admin", "/api/admin", "/ig", "/yt", "/tt"]) {
      assert.ok(
        b.disallow.includes(path),
        `${b.agent} 블록에서 ${path} 차단이 사라졌다`,
      );
    }
  }
});

test("매치를 열어 둔 동안 비용 상한이 살아 있다", () => {
  // ① 아카이브 매치 OG 는 satori 렌더를 하지 않는다(Active CPU 최상위였던 17분 항목).
  const og = stripComments(readFileSync("src/app/match/[slug]/opengraph-image.tsx", "utf8"));
  assert.ok(
    /og-default\.png/.test(og) && /Response\.redirect/.test(og),
    "아카이브 매치 OG 가 정적 이미지로 안 빠진다. 3,166건 각각에 satori 렌더가 붙으면 " +
      "Active CPU 최상위 항목이 되살아난다(실측 17분).",
  );
  assert.ok(
    !/schedule-archive\.json/.test(og),
    "매치 OG 가 다시 schedule-archive.json(978KB)을 받는다 — Origin Transfer 가 한도다.",
  );

  // ② 사이트맵에는 여전히 올리지 않는다. 크롤 양을 네이버가 이미 아는 URL + 내부 링크로 묶는다.
  const sitemap = stripComments(readFileSync("src/app/sitemap.ts", "utf8"));
  assert.ok(
    /const INCLUDE_MATCH_URLS = false;/.test(sitemap),
    "사이트맵이 매치 3,166건을 올린다. robots 를 네이버에만 열어 둔 상태에서 사이트맵까지 " +
      "열면 크롤 양의 상한이 사라진다 — 되돌림 기준 ③(ISR·CPU)이 먼저 터진다.",
  );
});
