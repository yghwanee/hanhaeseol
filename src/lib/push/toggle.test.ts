import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 알림 on/off 토글 가드.
 *
 * 여기서 막는 건 **유령 구독**이다. 끄기는 두 곳을 지워야 한다 — 서버(Blob)와 브라우저
 * (PushSubscription). 순서가 뒤바뀌면 로컬을 먼저 지운 뒤 서버 삭제가 실패했을 때
 * **endpoint 를 잃어버려 영영 지울 수 없는 구독**이 남는다: 화면은 "꺼짐"인데 알림은
 * 계속 온다. 사용자가 되돌릴 방법이 없는 종류의 고장이라 문자열로 고정한다.
 *
 * 그리고 종전 UI 회귀도 막는다 — 켜진 뒤 컨트롤이 사라져 **끌 방법이 화면에 없던** 상태
 * (2026-09-04 사용자 지적).
 */

const ROOT = process.cwd();
const BTN = path.join(ROOT, "src/app/_components/PushSubscribeButton.tsx");
const ROUTE = path.join(ROOT, "src/app/api/push/subscribe/route.ts");
// 🔴 구독 조작(켜기·끄기·찜 올리기)은 전부 이 모듈에 있다. 버튼이 사라져도 살아 있어야
//    하는 일이라 컴포넌트에서 떼어냈다(2026-09-15 작업121).
const CLIENT = path.join(ROOT, "src/lib/push/client.ts");
const SYNC = path.join(ROOT, "src/app/_components/PushFollowsSync.tsx");
const FOLLOWS_HOOK = path.join(ROOT, "src/app/_components/use-follows.ts");
const FOOTER = path.join(ROOT, "src/app/_components/SiteFooter.tsx");
const read = (p: string) => fs.readFileSync(p, "utf-8");

test("해제 엔드포인트(DELETE)가 있다", () => {
  const r = read(ROUTE);
  assert.match(r, /export async function DELETE/, "DELETE 핸들러가 없다 — 끌 방법이 없다");
  assert.match(r, /removeSubscription/, "저장소에서 지우지 않는다");
  assert.match(r, /missing endpoint/, "endpoint 누락을 400 으로 거르지 않는다");
});

test("🔴 서버를 먼저 지우고 로컬 구독을 해제한다 — 순서가 계약이다", () => {
  const src = read(CLIENT);
  const fn = src.slice(src.indexOf("export async function unsubscribePush"));
  // 이 함수 본문만 본다(뒤따르는 코드가 섞이지 않게 앞부분만).
  const body = fn.slice(0, 2000);

  const serverAt = body.indexOf('method: "DELETE"');
  const localAt = body.indexOf("sub.unsubscribe()");
  assert.ok(serverAt > -1, "서버 삭제(DELETE) 호출이 없다");
  assert.ok(localAt > -1, "로컬 구독 해제(sub.unsubscribe)가 없다");
  assert.ok(
    serverAt < localAt,
    "로컬 구독을 서버보다 먼저 해제한다 — 서버 삭제가 실패하면 endpoint 를 잃어 영영 지울 수 없는 유령 구독이 남는다(화면은 꺼짐, 알림은 계속 옴).",
  );
  assert.match(body, /if \(!res\.ok\) return false;/, "서버 삭제 실패를 성공처럼 넘긴다");
  assert.match(
    read(BTN),
    /setState\(ok \? "idle" : "subscribed"\)/,
    "서버 삭제 실패를 화면이 되돌리지 않는다 — 꺼진 것처럼 보이는데 알림은 계속 온다",
  );
});

test("🔴 켜진 상태에서도 컨트롤이 남는다 — 끌 방법이 있어야 한다", () => {
  const src = read(BTN);
  const block = src.slice(src.indexOf('if (state === "subscribed")'));
  const head = block.slice(0, block.indexOf("\n  }"));
  assert.ok(
    !/if \(ctaOnly\) return null/.test(head),
    "구독 후 ctaOnly 가 null 을 돌려준다 — 카드에서 상태도 안 보이고 끌 수도 없다",
  );
  assert.match(head, /Toggle on/, "켜진 상태를 토글로 그리지 않는다");
});

test("두 상태가 같은 컨트롤(Toggle)로 그려진다", () => {
  const src = read(BTN);
  assert.match(src, /function Toggle\(/, "Toggle 컴포넌트가 없다");
  assert.match(src, /onClick=\{unsubscribe\}/, "켜진 상태가 unsubscribe 에 연결되지 않았다");
  assert.match(src, /onClick=\{subscribe\}/, "꺼진 상태가 subscribe 에 연결되지 않았다");
});

test("토글에 접근성 상태가 붙는다", () => {
  const t = read(BTN).slice(read(BTN).indexOf("function Toggle("));
  assert.match(t, /aria-pressed=\{on\}/, "aria-pressed 가 없다 — 스크린리더가 on/off 를 모른다");
  assert.match(t, /aria-label=\{on \?/, "상태에 따라 aria-label 이 바뀌지 않는다");
  assert.match(t, /focus-visible:outline/, "키보드 포커스 표시가 없다");
});

test("🔴 알림 권한을 코드로 되돌리려 하지 않는다", () => {
  const src = read(BTN) + read(CLIENT);
  // 권한은 한 번 granted 면 브라우저 설정에서만 바꿀 수 있다. 끄기는 구독을 지우는 것이다.
  assert.ok(
    // 🔴 `=(?!=)` — 대입만 잡는다. `Notification.permission === "denied"` 는 정상 비교다.
    !/revokePermission|Notification\.permission\s*=(?!=)/.test(src),
    "알림 권한을 코드로 바꾸려 한다 — 불가능하고, 끄기는 구독 삭제로 해야 한다",
  );
  assert.match(
    src,
    /requestPermission/,
    "켤 때 권한을 요청하지 않는다",
  );
});

/**
 * 🔴 구독 주소 교체 유령 가드 (2026-09-15).
 *
 * 브라우저는 푸시 구독 주소를 예고 없이 갈아끼운다. 서버가 새 주소만 받으면 옛 주소 저장본이
 * 옛 찜 목록을 든 채 남아, 사용자가 찜을 전부 풀어도 알림이 계속 온다("찜 다 풀었는데 푸시가
 * 계속 와"). 세 군데가 같이 있어야 막힌다 — 하나만 빠져도 조용히 재발한다.
 */
test("🔴 구독 주소가 바뀌면 옛 저장본을 지운다(서비스워커·페이지·서버)", () => {
  const sw = read(path.join(ROOT, "public/sw.js"));
  assert.match(sw, /addEventListener\("pushsubscriptionchange"/, "서비스워커가 주소 교체를 안 받는다");
  assert.match(sw, /previousEndpoint/, "주소 교체 때 옛 주소를 서버에 안 알린다");

  const client = read(CLIENT);
  assert.match(client, /previousEndpoint/, "페이지 동기화가 옛 주소를 안 보낸다(서비스워커 이벤트를 놓친 경우의 안전망)");
  assert.match(client, /writeStoredEndpoint\(sub\.endpoint\)/, "올린 주소를 기억하지 않는다 — 다음 교체를 알아챌 수 없다");

  const route = read(ROUTE);
  const save = route.indexOf("await saveSubscription(");
  const drop = route.indexOf("if (previous) await removeSubscription(previous)");
  assert.ok(save > -1 && drop > -1, "서버가 옛 주소 저장본을 안 지운다");
  assert.ok(save < drop, "옛 저장본을 새 저장보다 먼저 지운다 — 저장이 실패하면 둘 다 잃는다");
});

/**
 * 🔴 별 히트영역 가드 (2026-09-04).
 *
 * 아이콘 18px + `-m-1 p-1` = 약 26px 이었고, 바로 밑에 매치 페이지로 가는 카드 전체
 * 링크가 깔려 있다. 손가락이 조금만 빗나가면 별이 아니라 **페이지 이동**이 일어나고,
 * 화면이 바뀌니 사람은 찜한 줄 안다 — 다음 날 "찜이 반영이 안 됐다"가 된다.
 * 마우스로는 거의 안 나는 증상이라 PC 확인만으로는 못 잡는다.
 */
test("🔴 ⭐찜 버튼 히트영역이 44px 이다", () => {
  const src = read(path.join(ROOT, "src/app/_components/FollowStar.tsx"));
  assert.match(
    src,
    /after:inset-\[-13px\]/,
    "히트영역 확장(after:inset-[-13px])이 없다 — 18px 아이콘 + 26px 는 iOS 최소치(44px) 미만이고, 빗나간 탭이 카드 링크로 샌다",
  );
  assert.match(src, /after:content-\[''\]/, "::after 에 content 가 없으면 영역이 안 생긴다");
  assert.match(src, /touch-manipulation/, "더블탭 확대 지연이 남는다");
});

/**
 * 🔴 푸시 미지원 환경에서 **아무것도 안 그리지 않는다** (2026-09-04 사용자 지적).
 *
 * iOS 사파리는 홈 화면에 추가해야 `PushManager` 가 생긴다. 종전에는 그때 컴포넌트가
 * 통째로 사라져서, 별을 눌러 둔 사용자가 "알림받기가 안 보인다"로 끝났다. 유입의 81%가
 * 네이버(인앱 웹뷰)라 그 갈래도 따로 안내해야 한다.
 */
test("🔴 iOS 미설치·인앱 웹뷰는 숨지 말고 다음 할 일을 안내한다", () => {
  const src = read(BTN);
  assert.match(src, /iosInstall/, "iOS 미설치 상태를 따로 안 가른다");
  assert.match(src, /inApp/, "인앱 웹뷰 상태를 따로 안 가른다");
  assert.match(src, /홈 화면에 추가/, "아이폰이 무엇을 해야 하는지 안 알려준다");
  assert.match(src, /maxTouchPoints/, "iPadOS 는 UA 가 Macintosh 라 터치포인트로 갈라야 한다");

  // 숨는 건 VAPID 미설정(셋업 문제)일 때뿐이어야 한다.
  const hide = src.match(/if \(state === "init" \|\| state === "unsupported"\) return null;/);
  assert.ok(hide, "렌더 분기가 바뀌었다 — 이 가드를 같이 고칠 것");
  assert.doesNotMatch(
    src,
    /setState\("unsupported"\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*if \(Notification/,
    "PushManager 부재를 다시 unsupported 로 뭉뚱그렸다",
  );
});

/**
 * 🔴 찜 해제가 서버까지 가는지 (2026-09-15, 작업121).
 *
 * 증상: "찜 다 풀었는데 푸시가 계속 와." 실측에서 구독 3건의 마지막 저장이 11일째
 * 9/03~04 에 멈춰 있었고 찜 목록도 그때 그대로였다 — 즉 **해제가 서버에 한 번도 안 갔다.**
 *
 * 해제가 서버에 반영되는 길은 이 컴포넌트의 재동기 effect 하나뿐인데, 종전에는 세 군데서
 * 끊겼다. 셋 다 막아야 재발하지 않는다.
 *   ① `state === "subscribed"` 게이트 — 서비스워커 조회가 늦거나 실패하면 state 가
 *      `idle` 로 굳고, state 는 마운트 때 한 번만 정해지므로 그 뒤 찜을 아무리 바꿔도
 *      **영영 안 올라간다.** 구독 유무는 state 가 아니라 `getSubscription()` 이 안다.
 *   ② 600ms 디바운스 — 별을 풀고 바로 탭을 닫으면 타이머가 취소돼 유실된다.
 *   ③ 유실 뒤 복구 장치 없음 — 서버 저장본은 무기한 살아 옛 찜으로 계속 발송한다.
 */
test("🔴 찜 재동기가 state 게이트에 묶이지 않는다", () => {
  const src = read(SYNC);
  assert.match(src, /putFollows/, "동기화기가 서버로 올리지 않는다");
  assert.doesNotMatch(
    src,
    /=== "subscribed"|!== "subscribed"/,
    "구독 상태 판정을 들고 재동기를 막는다 — 조회가 한 번 실패하면 그 브라우저는 찜을 풀어도 서버에 영영 못 알린다. 구독 유무는 putFollows 안의 getSubscription 이 판정한다.",
  );
});

test("🔴 찜 해제가 탭을 닫아도 서버에 도착한다(beacon flush)", () => {
  const src = read(CLIENT) + read(SYNC);
  assert.match(src, /sendBeacon/, "디바운스 중 탭이 닫히면 해제가 유실된다 — sendBeacon 으로 흘려보낼 것");
  assert.match(src, /"pagehide"/, "pagehide 에서 밀어내지 않는다 — 모바일은 여기가 마지막 기회다");
  assert.match(src, /visibilitychange/, "탭 전환(hidden)에서 밀어내지 않는다");

  const route = path.join(ROOT, "src/app/api/push/follows/route.ts");
  assert.ok(fs.existsSync(route), "beacon 이 때릴 라우트(/api/push/follows)가 없다");
  const r = read(route);
  assert.match(r, /export async function POST/, "beacon 은 POST 만 보낼 수 있다");
  assert.match(r, /readSubscription/, "기존 저장본을 안 읽는다 — beacon 에는 구독 키가 없다");
  assert.match(r, /saveSubscription/, "찜 목록을 저장하지 않는다");
});

test("🔴 오래 갱신 없는 구독은 발송에서 뺀다(유령 안전망)", () => {
  const notify = read(path.join(ROOT, "src/lib/push/notify.ts"));
  assert.match(notify, /export function isStaleSubscription/, "신선도 판정이 없다");

  const dispatch = read(path.join(ROOT, "src/app/api/push/dispatch/route.ts"));
  assert.match(dispatch, /isStaleSubscription/, "발송 쪽이 신선도를 안 본다 — 유령이 무기한 산다");
  assert.match(dispatch, /stale/, "dry 진단에 유령 표시가 없다");
});

test("🔴 살아 있는 구독은 주기적으로 갱신된다(하트비트)", () => {
  const src = read(CLIENT) + read(SYNC);
  // 찜이 그대로면 서버 쓰기가 안 나가므로, 신선도 안전망이 멀쩡한 구독까지 자른다.
  assert.match(src, /HEARTBEAT/, "하트비트가 없다 — 찜이 안 바뀌는 사용자는 신선도 상한에 걸려 알림이 끊긴다");
});

/**
 * 🔴 동기화기는 **버튼과 수명이 달라야 한다** (2026-09-15, 작업121).
 *
 * 종전에는 `PushSubscribeButton`(푸터 인스턴스)이 찜 동기화를 겸했다. 그래서 그 버튼이
 * 화면에서 사라지는 순간 — 푸터에서 빼거나, 찜이 0개가 돼 「내 팀」 섹션이 없어지거나 —
 * **찜 변경을 서버에 알릴 주체가 같이 사라졌다.** 찜을 전부 푼 사람에게 알림이 계속 가던
 * 고장이 이 구조에서 났다. 동기화는 버튼의 수명이 아니라 페이지의 수명을 따라야 한다.
 */
test("🔴 찜 동기화기가 전 페이지에 항상 걸려 있다", () => {
  const footer = read(FOOTER);
  assert.match(
    footer,
    /<PushFollowsSync \/>/,
    "전역 푸터에 동기화기가 없다 — 어떤 페이지에서는 찜 해제가 서버에 안 간다",
  );
  const sync = read(SYNC);
  assert.match(sync, /return null;/, "동기화기가 UI 를 그린다 — 보이는 컨트롤과 섞이면 다시 같이 사라진다");
  assert.doesNotMatch(sync, /ctaOnly/, "동기화기가 버튼의 prop 을 본다 — 버튼 렌더 조건에 다시 묶였다");
});

/**
 * 🔴 **찜하면 알림이 켜진다** (화니 지시, 2026-09-15).
 *
 * 종전 기본값은 꺼짐이었고, 켜려면 푸터까지 내려가 토글을 따로 눌러야 했다(편성 카드
 * 수십 장 아래라 아무도 안 내려간다). 찜은 "이 팀 경기를 놓치고 싶지 않다"는 뜻이므로
 * 알림이 그 기본값이다.
 */
test("🔴 찜하는 순간 알림 구독을 켠다 — 단 찜이 늘어날 때만", () => {
  const src = read(FOLLOWS_HOOK);
  assert.match(src, /ensureSubscribed/, "찜해도 알림 구독을 시도하지 않는다");
  assert.match(
    src,
    /next\.length > before\.length/,
    "찜 해제에도 구독을 시도한다 — 별을 빼는데 권한 창이 뜨면 앞뒤가 안 맞는다",
  );

  // 🔴 권한 요청이 사용자 제스처 안의 **첫 await** 여야 한다. 앞에 await 가 끼면 사파리는
  //    제스처가 만료된 것으로 보고 조용히 거절한다(별을 눌러도 알림이 안 켜진다).
  const client = read(CLIENT);
  const fn = client.slice(client.indexOf("export async function ensureSubscribed"));
  const body = fn.slice(0, 2000);
  const permAt = body.indexOf("requestPermission");
  const subAt = body.indexOf("await currentSubscription");
  assert.ok(permAt > -1 && subAt > -1, "권한 요청·구독 조회가 없다");
  assert.ok(permAt < subAt, "구독 조회를 권한 요청보다 먼저 await 한다 — 사파리에서 권한 요청이 무시된다");
});

/**
 * 🔴 **켠 사람에게는 끌 자리가 항상 있어야 한다** (2026-09-15).
 *
 * 알림 on/off 컨트롤은 홈 「내 팀」 섹션 하나뿐이다(푸터 토글은 같은 날 없앴다). 그런데
 * 그 섹션이 **찜 개수로만** 렌더되면, 알림을 켜 놓고 찜을 다 푼 사람은 끌 방법이 화면에서
 * 사라진다 — 화면에는 아무것도 없는데 알림은 계속 온다. 작업111 에서 이미 한 번 고친
 * 고장이라("켠 사람이 끌 방법이 없다") 문자열로 고정한다.
 */
test("🔴 찜이 0개여도 구독 중이면 끄기 컨트롤이 남는다", () => {
  const src = read(path.join(ROOT, "src/app/_components/MyTeamsSection.tsx"));
  const at = src.indexOf("if (rows.length === 0)");
  assert.ok(at > -1, "빈 상태 분기가 사라졌다 — 이 가드를 같이 고칠 것");
  const block = src.slice(at, at + 1200);
  assert.doesNotMatch(
    block.slice(0, 40),
    /if \(rows\.length === 0\) return null;/,
    "찜이 없으면 무조건 숨는다 — 알림을 켠 사람이 끌 방법을 잃는다",
  );
  assert.match(block, /hasSub/, "구독 여부를 보지 않는다");
  assert.match(block, /PushSubscribeButton/, "빈 상태에 끄기 컨트롤이 없다");
  assert.match(src, /currentSubscription/, "구독 상태를 조회하지 않는다");
  assert.match(src, /PUSH_SUB_EVENT/, "다른 곳에서 켜고 끈 것을 따라가지 않는다");
});

/**
 * 🔴 **「알림 받기」는 권한만 받고 끝나면 안 된다** (화니 지적, 2026-09-15).
 *
 * 찜한 팀이 없으면 `shouldReceive` 가 전부 걸러서 **실제로 오는 알림이 0건**이다.
 * "알림 받기를 눌렀는데 무슨 알림이 오는 거냐"가 정확히 그 얘기다. 그래서 켠 직후
 * 지금 시간 기준 **가장 임박한 경기**로 화면을 옮기고 카드·별을 강조한다 — 별이 어디
 * 있는지 글로 설명하는 것보다 그 자리로 데려가는 쪽이 확실하다.
 */
test("🔴 알림을 켜면 가장 임박한 경기로 데려간다", () => {
  const src = read(path.join(ROOT, "src/app/_components/NotifyIntroModal.tsx"));
  assert.match(src, /focusNextGame/, "켠 뒤 아무 데도 데려가지 않는다");
  assert.match(src, /data-game-start/, "경기 시작 시각 앵커를 안 쓴다");
  assert.match(src, /x\.at > now/, "이미 시작한 경기도 후보로 둔다 — 지난 경기로 데려가면 안 된다");
  assert.match(src, /data-star-hint/, "카드·별 강조 표시가 없다");
  assert.match(src, /prefers-reduced-motion/, "움직임을 줄인 사용자에게도 스무스 스크롤을 쓴다");

  // 카드가 앵커를 달고 있어야 한다 — KST 오프셋까지(브라우저 타임존이 달라도 같은 경기).
  const card = read(path.join(ROOT, "src/app/_components/ScheduleCard.tsx"));
  assert.match(card, /data-game-start=\{`\$\{schedule\.date\}T\$\{schedule\.time\}:00\+09:00`\}/,
    "경기 카드에 data-game-start(KST) 가 없다 — 모달이 갈 곳을 못 찾는다");

  // 강조 스타일이 있어야 애니메이션이 보인다(data 속성이라 Tailwind 가 안 만들어 준다).
  const css = read(path.join(ROOT, "src/app/globals.css"));
  assert.match(css, /\[data-star-hint\]/, "강조 CSS 가 없다");
  assert.match(css, /starHintStar/, "별 강조 keyframes 가 없다");

  /**
   * 🔴 **못 켜는 환경(아이폰 미설치·인앱 웹뷰)도 같은 곳으로 데려간다** (화니 지시,
   * 2026-09-15). 그쪽에서도 찜 자체는 되는데 종전에는 CTA 가 `close(true)` 만 해서
   * 모달이 사라지고 끝이었다 — 폰 사용자에게는 아무 일도 안 난 것으로 보인다.
   */
  const alt = src.slice(src.indexOf("canPush ? ("));
  const fallback = alt.slice(alt.indexOf(") : ("), alt.indexOf("{!canPush &&"));
  assert.match(
    fallback,
    /focusNextGame\(\)/,
    "못 켜는 환경의 CTA 가 닫고 끝난다 — PC 처럼 가장 임박한 경기로 데려갈 것",
  );
});

test("🔴 모달은 인트로가 끝나는 즉시 뜬다 — 추가 지연을 두지 말 것", () => {
  const src = read(path.join(ROOT, "src/app/_components/NotifyIntroModal.tsx"));
  const m = src.match(/const DELAY_MS = (\d+);/);
  assert.ok(m, "DELAY_MS 가 사라졌다 — 이 가드를 같이 고칠 것");
  assert.ok(
    Number(m[1]) <= 200,
    `인트로 뒤 지연이 ${m[1]}ms 다. 라이브 실측에서 모달까지 PC 7.4초가 걸렸고 대부분이 인트로다 — 여기서 더 늦추지 말 것(화니 지시).`,
  );
  assert.match(src, /INTRO_DONE_EVENT/, "인트로 종료를 안 기다린다 — 모달이 인트로 뒤에 깔린다");
});

/**
 * 🔴 **켜기가 실패하면 이유를 말한다** (화니, 2026-09-15: "알림 켜기 하니까 아무 반응 없는데?").
 *
 * 종전에는 거절·실패를 전부 `close()` 로 처리했다. 그러면 누른 사람 화면에서는 모달이
 * 아무 설명 없이 사라진다 — 눌렀는데 아무 일도 안 난 것처럼 보인다. 시크릿 창은 크롬이
 * 푸시 구독을 막으므로 **실패가 정상인 환경**인데, 그 사실이 화면에 없으면 고장으로 읽힌다.
 * 작업111 에서 같은 원칙을 세웠다(못 켜는 환경은 이유와 다음 할 일을 말한다).
 */
test("🔴 알림 켜기가 실패하면 조용히 닫지 않고 이유를 말한다", () => {
  const src = read(path.join(ROOT, "src/app/_components/NotifyIntroModal.tsx"));
  const fn = src.slice(src.indexOf("const turnOn = async"));
  const body = fn.slice(0, 1400);
  assert.doesNotMatch(
    body,
    /(denied|실패)[\s\S]{0,120}close\(true\);/,
    "거절·실패를 close() 로 처리한다 — 누른 사람에게는 아무 반응 없는 것으로 보인다",
  );
  assert.match(body, /setPhase\("failed"\)/, "실패 화면으로 넘기지 않는다");

  assert.match(src, /FAIL_TEXT/, "실패 이유별 문구가 없다");
  for (const key of ["denied", "unavailable", "failed"]) {
    assert.ok(src.includes(key + ": {"), "실패 갈래 " + key + " 문구가 없다");
  }
  // 시크릿 창은 실패가 정상인 환경이다 — 그 말을 반드시 화면에 둔다.
  assert.match(src, /시크릿/, "시크릿 창에서는 켤 수 없다는 안내가 없다");
  /**
   * 🔴 **문장 중간에서 줄이 끊기지 않게 문장마다 블록을 준다** (화니 지시, 2026-09-15).
   * 한 문자열로 두면 `시 눌러 주세요. 시크릿 창에서는` 처럼 두 문장 조각이 한 줄에 섞인다.
   * `break-keep` 은 단어만 지킨다. 실측(1280): 문장별 폭 317·167·236·183·248·317px ≤ 428px
   * 이라 PC 에서는 문장마다 한 줄에 선다.
   */
  assert.match(
    src,
    /body: \[/,
    "실패 본문이 한 문자열이다 — 문장 배열로 두고 문장마다 블록을 줄 것",
  );
  assert.match(
    src,
    /\.body\.map\(\(line\) => \(\s*<span key=\{line\} className="block">/,
    "문장을 블록으로 안 그린다 — 줄이 문장 중간에서 끊긴다",
  );

  // 알림을 못 켜도 찜은 되므로 그쪽으로 데려간다.
  assert.match(src, /STAR_CTA/, "실패 화면에 다음 할 일(찜)이 없다");
  assert.match(src, /const STAR_CTA = "경기 추가하기"/, "CTA 문구가 바뀌었다 — 「별」은 폰에서 무엇을 가리키는지 근거가 없다(화니 지시)");
});

/**
 * 🔴 **「닫기」는 아무것도 기록하지 않는다** (화니 지시, 2026-09-15).
 *
 * 그냥 닫은 사람에게는 홈에 들어올 때마다 다시 보여 준다. 한 번 보여주고 끝내면 안내를
 * 안 읽은 사람이 "기능이 있는 줄 모르는" 상태로 되돌아가기 때문이다. 그만 보고 싶은
 * 사람에게는 「오늘 하루 보지 않기」가 있고, **그게 유일한 차단 장치다.**
 */
test("🔴 「닫기」는 기억하지 않고 「오늘 하루 보지 않기」만 막는다", () => {
  const src = read(path.join(ROOT, "src/app/_components/NotifyIntroModal.tsx"));
  assert.ok(
    !src.includes("sessionStorage"),
    "닫기를 세션에 기록한다 — 그냥 닫은 사람에게 다시 안 뜬다(화니 지시 위반)",
  );
  const fn = src.slice(src.indexOf("const close = useCallback"));
  const body = fn.slice(0, 400);
  assert.match(body, /if \(today\) snoozeToday\(\);/, "오늘 하루 차단이 사라졌다");
  assert.ok(
    !/else\s/.test(body),
    "닫기에 별도 기록이 붙었다 — today 가 아니면 아무것도 저장하지 않아야 한다",
  );
  assert.match(src, /오늘 하루 보지 않기/, "차단 장치가 화면에 없다");
});

/**
 * 🔴 **알림을 켜는 것은 차단 기록이 아니다** (화니 지적, 2026-09-15).
 *
 * 종전에는 켜기 성공 직후 `snoozeToday()` 를 불렀다. 그러면 켰다가 다시 끈 사람에게
 * 그날 하루 안내가 영영 안 뜬다 — **구독은 없는데 차단 기록만 남은 상태**라, 알림이 꺼진
 * 채로 하루를 보내면서 다시 켜라는 말을 어디서도 못 듣는다. 켜 있는 동안은
 * `currentSubscription()` 게이트가 이미 막으므로 기록이 필요 없다.
 */
test("🔴 알림 켜기는 「오늘 하루」를 접지 않는다 — 껐으면 다시 뜬다", () => {
  const src = read(path.join(ROOT, "src/app/_components/NotifyIntroModal.tsx"));
  const fn = src.slice(src.indexOf("const turnOn = async"));
  const body = fn.slice(0, fn.indexOf("setPhase(\"failed\")"));
  assert.ok(
    !/^\s*snoozeToday\(\);/m.test(body),
    "켜기 성공 경로가 오늘을 접는다 — 켰다 끈 사람에게 안내가 안 뜬다",
  );
  // 구독 여부로 막는 게 유일한 정답이다.
  assert.match(src, /currentSubscription\(\)/, "구독 게이트가 사라졌다");
});

/**
 * 🔴 **모달 문구에서 한글 단어가 줄 끝에서 쪼개지지 않게 한다** (화니 지적, 2026-09-15).
 *
 * PC 폭에서 실패 안내가 `다 / 시 눌러 주세요` 로 잘려 있었다. 기본 `word-break` 는 한글을
 * 글자 단위로 끊으므로 `break-keep`(word-break: keep-all)이 없으면 어느 폭에서든 재발한다.
 */
test("🔴 모달 문구는 break-keep 으로 단어를 안 쪼갠다", () => {
  const src = read(path.join(ROOT, "src/app/_components/NotifyIntroModal.tsx"));
  // 제목 + 본문 + 각주 전부. 문장이 들어가는 자리는 모두 keep-all 이어야 한다.
  const texts = src.match(/className="[^"]*text-(headline1|label2|caption2)[^"]*"/g) ?? [];
  assert.ok(texts.length >= 4, "문구 자리를 못 찾았다 — 이 검사가 헛돌고 있다");
  for (const cls of texts) {
    assert.ok(
      cls.includes("break-keep"),
      "break-keep 이 없는 문구 자리가 있다(한글이 글자 단위로 쪼개진다): " + cls,
    );
  }
});
