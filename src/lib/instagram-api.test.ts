import assert from "node:assert/strict";
import test from "node:test";
import { buildCaption, isRetryableContainerFailure, isRetryableMediaCreate, parseContainerErrorCode } from "./instagram-api";
import { pickHeroForDate } from "./instagram";

// 2026-08-02 저녁 릴스 실패의 실제 status 문자열.
const REAL_2207052 = "Error: Media upload has failed with error code 2207052";

test("parseContainerErrorCode: status 문자열에서 Meta 에러 코드를 뽑는다", () => {
  assert.equal(parseContainerErrorCode(REAL_2207052), 2207052);
  assert.equal(parseContainerErrorCode("Error: Media upload has failed with error code 2207026"), 2207026);
  assert.equal(parseContainerErrorCode("In Progress: Media is still being processed."), null);
});

test("일시 오류(2207052)는 재시도 대상 — 이걸 놓쳐서 릴스가 안 올라갔다", () => {
  assert.equal(isRetryableContainerFailure("ERROR", REAL_2207052), true);
});

test("규격 위반(포맷·용량·화면비)은 재시도해도 같은 결과라 즉시 실패", () => {
  for (const code of [2207004, 2207005, 2207006, 2207009, 2207010, 2207026]) {
    assert.equal(
      isRetryableContainerFailure("ERROR", `Error: Media upload has failed with error code ${code}`),
      false,
      `${code} 는 영구 실패여야 한다`,
    );
  }
});

test("다운로드/트랜스코딩 일시 오류는 재시도 대상", () => {
  for (const code of [2207001, 2207003, 2207008, 2207020, 2207032, 2207053]) {
    assert.equal(
      isRetryableContainerFailure("ERROR", `Error: Media upload has failed with error code ${code}`),
      true,
      `${code} 는 재시도 대상이어야 한다`,
    );
  }
});

test("EXPIRED 는 새 컨테이너로 다시 만들면 되므로 재시도 대상", () => {
  assert.equal(isRetryableContainerFailure("EXPIRED", "Expired"), true);
});

test("코드를 못 읽으면 한 번은 더 시도한다(원인 불명)", () => {
  assert.equal(isRetryableContainerFailure("ERROR", "Error: something went wrong"), true);
});

// ── 캡션 중복 가드 ────────────────────────────────────────────────
// 2026-08-07 실측: 캐러셀과 릴스가 같은 실행에서 링크 UTM 만 빼고 글자까지 같은 캡션으로
// 나가고 있었다(`[REELS] 오늘 KIA 경기 …` = `[FEED] 오늘 KIA 경기 …`). 유튜브 피드
// 배포를 끊었던 것과 같은 중복 신호라, 게시면별로 본문 구조를 갈랐다.
// 날짜는 하드코딩하지 않는다 — schedule.json 이 오늘부터 7일치라, 박아 두면 지나는 순간
// 경기 없는 폴백 경로만 검사하게 된다.
const CAPTION_DATES = Array.from({ length: 4 }, (_, i) =>
  new Date(Date.now() + 9 * 3600_000 + i * 86400_000).toISOString().slice(0, 10),
);

test("캐러셀과 릴스 캡션은 어느 줄도 통째로 겹치지 않는다", () => {
  for (const d of CAPTION_DATES) {
    const mm = d.slice(5, 7);
    const dd = d.slice(8, 10);
    const feed = buildCaption(mm, dd, d, "https://haeseol.com/?u=post", "feed");
    const reel = buildCaption(mm, dd, d, "https://haeseol.com/?u=reel", "reel");

    assert.notEqual(feed, reel, `${d}: 캡션 전체가 동일`);
    assert.notEqual(feed.split("\n")[0], reel.split("\n")[0], `${d}: 첫 줄(후킹)이 동일`);

    // 해시태그 줄도 갈라야 한다 — 본문만 바꾸고 태그 줄이 같으면 그 줄이 다시 동일 신호가 된다.
    // 태그가 1개뿐이면 회전할 수 없다 — 그때만 예외.
    const lastLine = (s: string) => s.trimEnd().split("\n").pop() ?? "";
    if (lastLine(feed).startsWith("#") && lastLine(feed).split(" ").length >= 2) {
      assert.notEqual(lastLine(feed), lastLine(reel), `${d}: 해시태그 줄이 동일`);
    }
  }
});

test("릴스 캡션은 캐러셀보다 짧다 — 릴스는 히어로 한 경기에 집중한다", () => {
  for (const d of CAPTION_DATES) {
    const mm = d.slice(5, 7);
    const dd = d.slice(8, 10);
    const feed = buildCaption(mm, dd, d, "https://haeseol.com/", "feed");
    const reel = buildCaption(mm, dd, d, "https://haeseol.com/", "reel");
    assert.ok(
      reel.split("\n").length <= feed.split("\n").length,
      `${d}: 릴스 캡션이 캐러셀보다 길다`,
    );
  }
});

test("릴스 캡션의 '주목 경기' 줄은 후킹 문장의 주인공과 같은 경기다", () => {
  for (const d of CAPTION_DATES) {
    const hero = pickHeroForDate(d);
    if (!hero) continue;
    const reel = buildCaption(d.slice(5, 7), d.slice(8, 10), d, "https://haeseol.com/", "reel");
    const idx = reel.split("\n").findIndex((l) => l.includes("주목 경기"));
    if (idx < 0) continue;
    const matchLine = reel.split("\n")[idx + 1];
    // 목록은 pickHeroMatchesTop(감점 없음) 순서라, 그냥 첫 줄을 쓰면 후킹 주인공과 갈린다.
    // 실측 2026-08-08: 후킹 "이정후" ↔ 목록 첫 줄 "다저스".
    assert.ok(
      matchLine.includes(hero.homeTeam),
      `${d}: 후킹 주인공(${hero.homeTeam})과 다른 경기가 실림 — ${matchLine}`,
    );
  }
});

// 2026-08-15 아침 캐러셀 전멸의 실제 에러(로그 그대로). Meta 의 PNG→JPEG 변환이 죽었고,
// is_transient:false 라 재시도 없이 첫 시도에 exit 1 났다. 파일은 CRC 까지 멀쩡했다.
const REAL_2207084 = {
  message: "The image format is not supported.",
  type: "OAuthException",
  code: 36001,
  error_subcode: 2207084,
  is_transient: false,
};

test("이미지 변환 실패(2207084)는 재시도 대상 — 이걸 놓쳐서 캐러셀이 안 올라갔다", () => {
  assert.equal(isRetryableMediaCreate(REAL_2207084), true);
});

test("진짜 영구 오류는 재시도하지 않는다(못 올릴 파일에 10분을 쓰지 않는다)", () => {
  assert.equal(isRetryableMediaCreate(undefined), false);
  // 토큰 만료 — 재시도해도 같은 결과
  assert.equal(isRetryableMediaCreate({ code: 190, message: "Invalid OAuth access token" }), false);
});

test("기존 일시 오류 분류(9004 / 2207052 / is_transient)는 그대로 유지된다", () => {
  assert.equal(isRetryableMediaCreate({ code: 9004 }), true);
  assert.equal(isRetryableMediaCreate({ error_subcode: 2207052 }), true);
  assert.equal(isRetryableMediaCreate({ code: 2, is_transient: true }), true);
});
