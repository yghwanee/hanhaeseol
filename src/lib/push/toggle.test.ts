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
const read = (p: string) => fs.readFileSync(p, "utf-8");

test("해제 엔드포인트(DELETE)가 있다", () => {
  const r = read(ROUTE);
  assert.match(r, /export async function DELETE/, "DELETE 핸들러가 없다 — 끌 방법이 없다");
  assert.match(r, /removeSubscription/, "저장소에서 지우지 않는다");
  assert.match(r, /missing endpoint/, "endpoint 누락을 400 으로 거르지 않는다");
});

test("🔴 서버를 먼저 지우고 로컬 구독을 해제한다 — 순서가 계약이다", () => {
  const src = read(BTN);
  const fn = src.slice(src.indexOf("const unsubscribe"));
  const body = fn.slice(0, fn.indexOf("\n  };"));

  const serverAt = body.indexOf('method: "DELETE"');
  const localAt = body.indexOf("sub.unsubscribe()");
  assert.ok(serverAt > -1, "서버 삭제(DELETE) 호출이 없다");
  assert.ok(localAt > -1, "로컬 구독 해제(sub.unsubscribe)가 없다");
  assert.ok(
    serverAt < localAt,
    "로컬 구독을 서버보다 먼저 해제한다 — 서버 삭제가 실패하면 endpoint 를 잃어\n" +
      "  영영 지울 수 없는 유령 구독이 남는다(화면은 꺼짐, 알림은 계속 옴).",
  );
  assert.match(
    body,
    /if \(!res\.ok\)\s*\{[\s\S]{0,80}setState\("subscribed"\)/,
    "서버 삭제가 실패했는데 되돌리지 않는다 — 화면과 서버가 어긋난 채로 남는다",
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
  const src = read(BTN);
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
