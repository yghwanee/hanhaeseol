/**
 * 저장해 둔 토스 상품들의 가격을 다시 확인한다.
 *
 *   npm run toss:refresh
 *
 * 🔴 이게 왜 필요한가: 화면은 빌드 시점 스냅샷을 보여 주는데 토스 가격은 수시로
 * 바뀐다. 낡은 값을 계속 띄우면 실제와 다른 가격을 광고하는 게 된다(표시광고법).
 * 그래서 화면 쪽은 `checkedAt` 이 14일을 넘기면 **가격을 숨기고** 상품명·링크만
 * 낸다. 이 스크립트는 그 시계를 되감는 유일한 방법이다.
 *
 * 품절·마감 상품은 저장소에서 **지운다.** 살 수 없는 걸 계속 거는 게 더 나쁘다.
 * 링크는 다시 발급하지 않는다(같은 조합은 항상 같은 링크라 발급 쿼터만 태운다).
 */
// 🔴 dotenv/config 가 아니다 — .env 와 OneDrive 공용 파일(PC 3대 공유)을 함께 읽는다.
import "@/lib/env/shared-env";
import fs from "node:fs";
import path from "node:path";
import { getProductDetail } from "@/lib/toss/api";
import { TossApiFailure, explainError } from "@/lib/toss/client";
import type { TossPicksStore } from "@/lib/affiliate/toss-picks";

const STORE = path.resolve("src/data/toss-picks.json");
/** 상세 조회는 한 번에 최대 30건이다. */
const BATCH = 30;

function kstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function main() {
  const store = JSON.parse(fs.readFileSync(STORE, "utf8")) as TossPicksStore;
  const keys = Object.keys(store.picks);
  if (keys.length === 0) {
    console.log("저장된 상품이 없다. `npm run toss:pick -- <tacaItemId> --key=<슬러그>` 로 먼저 고를 것.");
    return;
  }

  const today = kstToday();
  const removed: string[] = [];
  let updated = 0;
  /**
   * 파일을 실제로 건드렸나.
   * 🔴 이게 없으면 `lastUpdated` 타임스탬프만 바뀌어 **매 실행마다 커밋이 난다.**
   * 하루 한 번은 `checkedAt` 이 넘어가니 당연히 써야 하고(그 값이 배포에 실려야 화면이
   * 가격을 계속 보여준다), 같은 날 두 번째 실행은 아무것도 안 바뀌니 쓰면 안 된다.
   */
  let mutated = false;

  try {
    for (let i = 0; i < keys.length; i += BATCH) {
      const chunk = keys.slice(i, i + BATCH);
      const ids = chunk.map((k) => store.picks[k].tacaItemId);
      const res = await getProductDetail({ tacaItemIds: ids });
      const byId = new Map(res.items.map((it) => [it.tacaItemId, it]));

      for (const key of chunk) {
        const pick = store.picks[key];
        const item = byId.get(pick.tacaItemId);
        if (!item || item.isSoldOut) {
          delete store.picks[key];
          if (store.deal === key) store.deal = null;
          removed.push(`${key} (${item ? "품절" : "조회 안 됨"}) — ${pick.displayName}`);
          mutated = true;
          continue;
        }
        // 🔴 이전 값을 먼저 붙잡는다 — 아래에서 덮어쓴 뒤 읽으면 "변동 없음"만 찍힌다.
        const prevPrice = pick.displayPrice;
        const changed = item.displayPrice !== prevPrice;
        if (
          changed ||
          pick.checkedAt !== today ||
          pick.displayName !== item.displayName ||
          pick.originalPrice !== item.originalPrice ||
          pick.discountRate !== item.discountRate ||
          (pick.endAt ?? null) !== (item.endAt ?? null)
        ) {
          mutated = true;
        }
        pick.displayName = item.displayName;
        pick.displayPrice = item.displayPrice;
        pick.originalPrice = item.originalPrice;
        pick.discountRate = item.discountRate;
        pick.checkedAt = today;
        if (item.endAt) pick.endAt = item.endAt;
        else delete pick.endAt;
        updated += 1;
        console.log(
          `${changed ? "가격 변동" : "확인   "} ${key.padEnd(20)} ${item.displayPrice.toLocaleString("ko-KR")}원` +
            (changed ? `  (이전 ${prevPrice.toLocaleString("ko-KR")}원)` : ""),
        );
      }
    }
  } catch (e) {
    const msg =
      e instanceof TossApiFailure ? `${e.errorCode} — ${explainError(e.errorCode)}` : (e as Error).message;
    console.error("실패:", msg);
    process.exit(1);
  }

  if (mutated) {
    const picks: TossPicksStore["picks"] = {};
    for (const k of Object.keys(store.picks).sort()) picks[k] = store.picks[k];
    fs.writeFileSync(
      STORE,
      JSON.stringify({ ...store, picks, lastUpdated: new Date().toISOString() }, null, 2) + "\n",
      "utf8",
    );
  } else {
    console.log("바뀐 게 없다 — 파일을 건드리지 않는다(빈 커밋 방지).");
  }

  console.log(`\n갱신 ${updated}건 · 삭제 ${removed.length}건 (기준일 ${today})`);
  for (const r of removed) console.log(`  삭제: ${r}`);
  if (removed.length) console.log("  → 그 글 본문의 `:::toss <key>:::` 마커는 자동으로 사라진다(빈 자리만 남는다).");
}

main();
