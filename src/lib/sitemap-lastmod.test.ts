import { test } from "node:test";
import assert from "node:assert/strict";
import sitemap from "@/app/sitemap";

/**
 * 사이트맵 lastmod 정확성 가드.
 *
 * 🔴 2026-08-19 실측: 매치 URL 이 **경기일**을 lastmod 로 쓰고 있었다. 편성이 오늘부터
 * 7일치라 예정 경기 92건이 항상 미래 날짜(최대 오늘+6일)를 주장했다.
 *
 * Google 사이트맵 문서는 lastmod 가 부정확하면 그 값을 무시한다고 명시한다. 실제로
 * GSC 의 "마지막으로 읽은 날짜"가 2026-06-22 에서 58일째 멈춰 있었고, 발견 페이지도
 * 848 로 고정이었다(그 시점 사이트맵 실제 URL 2,164 / 색인 54).
 *
 * 미래 lastmod 는 어떤 URL 유형에서도 정당화되지 않는다 — 아직 일어나지 않은 수정이다.
 * 이 테스트가 그 규칙을 고정한다. 되돌리면(`clamp` 제거) 즉시 실패한다.
 */

const entries = sitemap();

test("사이트맵에 미래 lastmod 가 없다", () => {
  // 빌드 시각과 검사 시각 사이의 오차만 허용한다(초 단위). 하루를 허용하면
  // "경기일 lastmod" 회귀를 다시 통과시켜 버린다.
  const limit = Date.now() + 60_000;
  const future = entries.filter(
    (e) => e.lastModified && new Date(e.lastModified).getTime() > limit,
  );

  assert.equal(
    future.length,
    0,
    `미래 lastmod ${future.length}건. 예: ${future
      .slice(0, 3)
      .map((e) => `${e.url} → ${new Date(e.lastModified!).toISOString()}`)
      .join(" / ")}`,
  );
});

test("lastmod 가 유효한 날짜다", () => {
  const invalid = entries.filter(
    (e) => e.lastModified && Number.isNaN(new Date(e.lastModified).getTime()),
  );
  assert.equal(invalid.length, 0, `Invalid Date lastmod: ${invalid.length}건`);
});

test("사이트맵이 비어 있지 않다(스캐너 자체 회귀 방지)", () => {
  assert.ok(entries.length > 100, `사이트맵 URL ${entries.length}개 — 너무 적다`);
  const withLastmod = entries.filter((e) => e.lastModified).length;
  assert.ok(
    withLastmod > entries.length * 0.9,
    `lastmod 없는 URL 이 너무 많다: ${entries.length - withLastmod}/${entries.length}`,
  );
});
