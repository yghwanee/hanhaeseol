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
