import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { TIKTOK_SCOPES, TIKTOK_DISPLAY_SCOPES, authorizeScopes } from "./tiktok-api";

// 🔴 2026-09-01. @hanhaeseol 은 2026-06 게시 시작 이후 **모든 영상이 조회수 0** 이었다.
// 게시 자체는 정상이었다 — 옛 publish_id 를 다시 조회하니 7건 전부
// status=PUBLISH_COMPLETE 이고 publicaly_available_post_id 가 채워져 있었다
// (= 공개 + 모더레이션 승인). oEmbed 도 200 이다. 즉 문제는 게시가 아니라 **배포**다.
//
// TikTok 커뮤니티 가이드라인에서 우리가 실제로 걸리던 것 둘:
//   ① 미표기 마케팅 콘텐츠는 For You 피드 부적격 → brand_organic_toggle 을
//      한 번도 안 보냈다(아웃트로가 "한해설 검색"으로 우리 서비스를 홍보한다).
//   ② AI 생성 콘텐츠 라벨(is_aigc)이 `true` 로 **상수 고정**돼 있었다. 라벨 자체는
//      정책상 허용이지만 도달에 불리하게 관측되고, 무엇보다 우리 후킹 이미지
//      183장이 전부 ChatGPT 생성물이라 그 라벨을 뗄 수가 없었다.
//      → 틱톡판만 AI 사진을 안 쓰는 그래픽 배경으로 바꿔 라벨을 정직하게 뗀다.
//
// 아래 검사는 그 둘이 되돌아가지 않게 막는다.

const read = (p: string) => fs.readFileSync(p, "utf8");

test("🔴 is_aigc 를 상수로 박지 않는다", () => {
  const api = read("src/lib/tiktok-api.ts");
  assert.match(api, /is_aigc: p\.isAigc/, "is_aigc 는 호출부가 넘긴 사실값이어야 한다");
  assert.doesNotMatch(api, /is_aigc:\s*(true|false)\b/, "is_aigc 를 리터럴로 고정하지 말 것");
});

test("🔴 isAigc 는 선택 필드가 아니다 — 호출부가 반드시 판단해야 한다", () => {
  // optional 로 두면 새 호출부가 조용히 라벨을 빠뜨린다(정책 위반).
  assert.match(read("src/lib/tiktok-api.ts"), /^\s{2}isAigc: boolean;$/m);
});

test("🔴 우리 사업 홍보 표기(brand_organic_toggle)를 보낸다", () => {
  assert.match(read("src/lib/tiktok-api.ts"), /brand_organic_toggle: p\.brandOrganicToggle/);
  assert.match(read("src/scripts/post-tiktok.ts"), /brandOrganicToggle: true/);
});

test("🔴 manifest 에 AI 여부가 없으면 true 로 본다(라벨 누락이 더 나쁘다)", () => {
  assert.match(read("src/scripts/post-tiktok.ts"), /reelTiktokAigc \?\? true/);
});

test("🔴 틱톡판 릴스는 AI 사진을 쓰지 않고, 그 사실을 manifest 에 남긴다", () => {
  const reel = read("src/scripts/make-reel-v2.ts");
  assert.match(reel, /noAiImage: TIKTOK/, "틱톡 변형에 noAiImage 가 붙어 있어야 한다");
  assert.match(
    reel,
    /reelTiktok: OUTPUT, reelTiktokAigc: false/,
    "AI 사진을 안 썼다는 사실을 manifest 에 기록해야 post-tiktok 이 라벨을 뗀다",
  );
  assert.match(
    reel,
    /TIKTOK \? "" : pickHookImage\(today\)/,
    "틱톡판은 후킹 사진(=ChatGPT 생성물)을 고르지 않아야 한다",
  );
});

test("IG·유튜브 경로는 AI 사진을 그대로 쓴다(틱톡만 바꾼 것)", () => {
  const reel = read("src/scripts/make-reel-v2.ts");
  // noAiImage 가 TIKTOK 에만 걸려 있어야 한다. 무조건 true 면 IG/YT 커버까지 바뀐다.
  assert.doesNotMatch(reel, /noAiImage:\s*true/);
});

test("🔴 authorize 스코프에 미승인 제품 스코프를 섞지 않는다", () => {
  // 2026-09-01 실제로 막혔다. video.list 는 Display API 제품에 딸려 오는데
  // 이 앱에는 그 제품이 안 붙어 있어서, authorize URL 에 넣는 순간 TikTok 이
  // "문제가 발생했습니다 · scope" 로 **로그인 자체를 거부**한다 = 재인증 불가.
  // 앱 심사로 Display API 가 붙기 전까지는 기본 셋만 나가야 한다.
  delete process.env.TIKTOK_ENABLE_DISPLAY_API;
  assert.deepEqual(authorizeScopes(), TIKTOK_SCOPES);
  for (const s of TIKTOK_DISPLAY_SCOPES) {
    assert.ok(!TIKTOK_SCOPES.includes(s), `${s} 는 심사 전이라 기본 셋에 들어가면 안 된다`);
  }
});

test("Display API 승인 후에는 플래그로 조회 스코프를 켤 수 있다", () => {
  process.env.TIKTOK_ENABLE_DISPLAY_API = "1";
  const got = authorizeScopes();
  delete process.env.TIKTOK_ENABLE_DISPLAY_API;
  assert.ok(got.includes("video.list"));
  assert.ok(got.includes("user.info.stats"));
  assert.ok(got.includes("video.publish"), "게시 스코프는 항상 유지");
});

test("그래픽 배경은 날짜마다 달라진다(매일 같은 프레임 = 중복 신호)", async () => {
  const { renderReelTitleBackground } = await import("./reel-title-card");
  const a = await renderReelTitleBackground("", "9:16", "evening", {
    noAiImage: true,
    today: "2026-09-01",
  });
  const b = await renderReelTitleBackground("", "9:16", "evening", {
    noAiImage: true,
    today: "2026-09-02",
  });
  assert.ok(a.length > 1000 && b.length > 1000, "배경이 그려져야 한다");
  assert.notEqual(a.toString("base64"), b.toString("base64"), "날짜가 다르면 배경도 달라야 한다");
});

test("BGM 시작 오프셋이 곡 길이를 넘지 않는다", () => {
  // bgm.mp3 는 73.5초, 영상은 최대 ~16초. 오프셋 상한 39 + 16 = 55 < 73.5.
  const reel = read("src/scripts/make-reel-v2.ts");
  const m = reel.match(/%\s*(\d+)\)/);
  assert.ok(m, "오프셋 모듈러 상수를 찾지 못했다");
  const max = Number(m![1]) - 1;
  assert.ok(max + 20 < 73, `오프셋 상한 ${max}s + 영상 길이가 BGM(73.5s)을 넘는다`);
});
