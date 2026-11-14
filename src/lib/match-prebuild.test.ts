import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import worldcupData from "@/data/worldcup.json";
import type { Schedule, ScheduleData } from "@/types/schedule";
import { dedupeReversedFixtures } from "./fixture-dedupe";
import { findMatchBySlug, matchToSlug } from "./match-slug";
import { isRetiredMatchDate } from "./match-retention";
import { prebuildMatchParams } from "./match-prebuild";
import { findCurrentMatch, isNearTodayKst, matchOgImageUrl, matchOgSlugs } from "./match-og";

/**
 * 런타임 렌더를 빌드로 옮긴 가드 (2026-11-14, 이슈 #96 — Hobby Active CPU 초과로 계정 잠김).
 *
 * 막는 것:
 *  ①매치 프리렌더 목록이 페이지가 실제로 해석하는 슬러그와 어긋나는 것(구운 페이지가 404)
 *  ②종전 목록(현재 편성)이 빠지는 것
 *  ③OG 라우트가 다시 런타임에 satori 를 돌리거나, 빌드 중 자기 사이트에서 폰트를 받는 것
 *    (계정이 402 로 잠긴 동안 빌드가 깨진다)
 *  ④매치 페이지 `dynamicParams=false` 회귀(2026-05-13 한글 슬러그 전부 404 사고)
 */

const data = scheduleData as unknown as ScheduleData;
const archive = archiveData as unknown as ScheduleData;
const worldcup = worldcupData as unknown as ScheduleData;

// page.tsx 의 slugLookup 과 같은 순서 — 순서가 계약이다.
const lookup: Schedule[] = dedupeReversedFixtures([
  ...data.schedules,
  ...worldcup.schedules,
  ...archive.schedules,
]);

const params = prebuildMatchParams(lookup);
const slugs = new Set(params.map((p) => p.slug));

test("구운 슬러그는 전부 해석되고 보존 기간 안이다", () => {
  assert.ok(params.length > 0);
  assert.equal(slugs.size, params.length, "중복 슬러그");
  for (const { slug } of params) {
    const m = findMatchBySlug(lookup, slug);
    assert.ok(m, `해석 실패 ${slug}`);
    assert.equal(isRetiredMatchDate(m.date), false, `보존 기간 밖 ${slug}`);
  }
});

test("해석되는 보존 기간 안 슬러그는 하나도 빠지지 않는다", () => {
  for (const s of lookup) {
    if (isRetiredMatchDate(s.date)) continue;
    const slug = matchToSlug(s);
    const m = findMatchBySlug(lookup, slug);
    if (!m || isRetiredMatchDate(m.date)) continue;
    assert.ok(slugs.has(slug), `빠짐 ${slug}`);
  }
});

test("종전 목록(현재 편성 + 월드컵)은 새 목록의 부분집합", () => {
  for (const s of dedupeReversedFixtures([...data.schedules, ...worldcup.schedules])) {
    if (isRetiredMatchDate(s.date)) continue;
    assert.ok(slugs.has(matchToSlug(s)), `종전엔 구웠는데 빠짐 ${matchToSlug(s)}`);
  }
});

test("NFC 로 구워진다 (Linux 빌드 한글 슬러그 사고)", () => {
  for (const { slug } of params) assert.equal(slug, slug.normalize("NFC"));
});

const read = (p: string) => readFileSync(p, "utf8");

test("매치 페이지는 dynamicParams=true 를 유지한다", () => {
  const src = read("src/app/match/[slug]/page.tsx");
  assert.match(src, /export const dynamicParams = true;/);
  assert.match(src, /prebuildMatchParams\(slugLookup\)/);
});

for (const file of ["src/app/og/match/[slug]/route.tsx", "src/app/guide/[slug]/opengraph-image.tsx"]) {
  test(`${file}: 빌드 때 굽고 자기 사이트에서 폰트를 받지 않는다`, () => {
    const src = read(file);
    assert.match(src, /export function generateStaticParams/);
    assert.match(src, /loadOgAssets\(\)/);
    assert.doesNotMatch(src, /fetch\(`\$\{BASE\}\/fonts/);
  });
}

test("매치 OG 는 런타임 요청을 렌더하지 않고, 빌드 중엔 날짜를 다시 보지 않는다", () => {
  const src = read("src/app/og/match/[slug]/route.tsx");
  assert.match(src, /if \(!isBuildPhase\(\)\) return toDefault\(\);/);
  assert.match(src, /s-maxage=86400/);
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ""), /isNearToday/);
});

test("매치 OG 는 파일 컨벤션으로 되돌리지 않는다 (한글 슬러그 이중 인코딩)", () => {
  assert.throws(() => read("src/app/match/[slug]/opengraph-image.tsx"));
  const page = read("src/app/match/[slug]/page.tsx");
  assert.match(page, /const ogImage = matchOgImageUrl\(match\)/);
  assert.match(page, /images: \[ogImage\]/);
});

test("페이지가 거는 OG 주소 = 구운 경로, 한 번만 인코딩", () => {
  const ogSlugs = matchOgSlugs();
  for (const s of [...data.schedules, ...worldcup.schedules]) {
    const url = matchOgImageUrl(s);
    const slug = matchToSlug(s);
    if (ogSlugs.has(slug)) {
      assert.equal(url, `https://haeseol.com/og/match/${encodeURIComponent(slug)}`);
      assert.doesNotMatch(url, /%25/, `이중 인코딩 ${url}`);
      assert.equal(decodeURIComponent(url.split("/og/match/")[1]), slug);
      assert.equal(isNearTodayKst(findCurrentMatch(slug)!.date), true);
    } else {
      assert.equal(url, "https://haeseol.com/og-default.png");
    }
  }
});

test("OG 자산은 빌드 중 public 을 fs 로 읽는다", () => {
  const src = read("src/lib/og-assets.ts");
  assert.match(src, /readFile\(path\.join\(process\.cwd\(\), "public"/);
  assert.match(src, /phase-production-build/);
});
