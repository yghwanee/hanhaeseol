/**
 * 가이드 글·홈 띠에 걸 상품 하나를 고르고 저장한다.
 *
 *   npm run toss:pick -- <tacaItemId> --key=stadium-cushion --note="9월 밤 경기용"
 *   npm run toss:pick -- <tacaItemId> --key=k --slot=home-top        # 그 자리에 건다
 *   npm run toss:pick -- --slot=home-top=stadium-cushion             # 자리 상품만 교체
 *   npm run toss:pick -- --slot=home-top=off                         # 그 자리 끄기
 *
 * 자리: home-top(필터 아래) · home-inline(오후 경기 구분선 아래) · match(매치 페이지)
 * 🔴 home-top 과 home-inline 은 **같은 화면**이라 다른 상품을 걸어야 한다(가드가 막는다).
 *
 * 🔴 **이 PC 에서 돌린다.** 토스는 호출 IP 를 사전 등록받는데 Vercel 함수도 GitHub
 * Actions 도 나가는 IP 가 고정이 아니다. 결과 JSON 을 커밋해서 쓰는 구조다.
 *
 * 🔴 상품을 **사람이 고른다**는 게 이 스크립트의 핵심이다. 목록을 긁어 자동으로
 * 꽂으면 운영정책의 "여러 상품의 이미지와 쉐어링크 자동 연동", "API 데이터로 별도
 * 상품 DB 구성"에 걸려 사전 확인 대상이 된다. 한 번에 한 개씩, 손으로 고른다.
 *
 * 🔴 링크는 한 번만 발급한다. 같은 (tacaItemId, publisherId) 는 항상 같은 링크라
 * 이미 저장돼 있으면 재사용한다 — 매번 부르면 일일 쿼터(10,000건)만 태운다.
 */
// 🔴 dotenv/config 가 아니다 — .env 와 OneDrive 공용 파일(PC 3대 공유)을 함께 읽는다.
import "@/lib/env/shared-env";
import fs from "node:fs";
import path from "node:path";
import { getProductDetail, createShareLink } from "@/lib/toss/api";
import { TossApiFailure, explainError } from "@/lib/toss/client";
import { TOSS_SLOTS, type TossPick, type TossPicksStore, type TossSlot } from "@/lib/affiliate/toss-picks";

const STORE = path.resolve("src/data/toss-picks.json");

function readStore(): TossPicksStore {
  return JSON.parse(fs.readFileSync(STORE, "utf8")) as TossPicksStore;
}

export function writeStore(store: TossPicksStore): void {
  // 키 순서를 정렬해 둔다 — 안 그러면 갱신할 때마다 diff 가 통째로 튄다.
  const picks: Record<string, TossPick> = {};
  for (const k of Object.keys(store.picks).sort()) picks[k] = store.picks[k];
  const out: TossPicksStore = { ...store, picks, lastUpdated: new Date().toISOString() };
  fs.writeFileSync(STORE, JSON.stringify(out, null, 2) + "\n", "utf8");
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  return eq === -1 ? "" : hit.slice(eq + 1);
}

/** KST 기준 오늘. 저장하는 checkedAt 은 화면의 낡음 판정과 같은 기준이어야 한다. */
function kstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function main() {
  const store = readStore();

  const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  /** 자리에 키를 건다. `deal` 은 home-inline 의 옛 이름이라 같이 맞춰 준다. */
  function setSlot(slot: TossSlot, key: string | null) {
    store.slots = { ...(store.slots ?? {}), [slot]: key };
    if (slot === "home-inline") store.deal = key;
  }

  // `--slot=home-top=<key>` / `--slot=home-top=off` 만 주면 자리 배정만 바꾼다(API 호출 없음).
  const slotArg = arg("slot") ?? "";
  const [slotName, slotValue] = slotArg.split("=") as [string, string | undefined];
  if (slotName && !TOSS_SLOTS.includes(slotName as TossSlot)) {
    console.error(`모르는 자리: ${slotName}. 쓸 수 있는 자리: ${TOSS_SLOTS.join(", ")}`);
    process.exit(1);
  }
  if (slotName && slotValue !== undefined && positional.length === 0) {
    if (slotValue === "off") {
      setSlot(slotName as TossSlot, null);
      writeStore(store);
      console.log(`'${slotName}' 자리를 껐다.`);
      return;
    }
    if (!store.picks[slotValue]) {
      console.error(`저장된 pick 에 '${slotValue}' 가 없다. 먼저 발급할 것.`);
      console.error(`  보유 키: ${Object.keys(store.picks).join(", ") || "(없음)"}`);
      process.exit(1);
    }
    setSlot(slotName as TossSlot, slotValue);
    writeStore(store);
    console.log(`'${slotName}' 자리를 '${slotValue}' 로 바꿨다.`);
    return;
  }

  const tacaItemId = Number(positional[0]);
  if (!positional[0] || !Number.isFinite(tacaItemId)) {
    console.error(
      "사용: npm run toss:pick -- <tacaItemId> --key=<슬러그> [--note=\"한 줄 소개\"] [--slot=<자리>]\n" +
        `  자리: ${TOSS_SLOTS.join(" · ")}`,
    );
    process.exit(1);
  }
  const key = arg("key") || `p${tacaItemId}`;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) {
    console.error(`--key 는 영소문자·숫자·하이픈만 쓴다(마크다운 마커에 들어간다): ${key}`);
    process.exit(1);
  }

  try {
    // 1. 상품 정보 — 이름·가격·할인율을 받는다. 🔴 이미지 URL 은 일부러 저장하지 않는다.
    const detail = await getProductDetail({ tacaItemIds: [tacaItemId] });
    const item = detail.items?.[0];
    if (!item) {
      console.error(`상품을 못 찾았다 (notFoundIds: ${detail.notFoundIds?.join(", ") || "-"})`);
      process.exit(1);
    }
    if (item.isSoldOut) {
      console.error(`품절 상품이다: ${item.displayName}`);
      process.exit(1);
    }

    // 2. 링크 — 이미 있으면 재사용(같은 조합은 항상 같은 링크다).
    const existing = Object.values(store.picks).find((p) => p.tacaItemId === tacaItemId);
    const shortUrl = existing?.shortUrl ?? (await createShareLink(tacaItemId)).shortUrl;
    if (existing) console.log(`기존 링크 재사용 (쿼터 절약): ${shortUrl}`);

    const note = arg("note");
    const pick: TossPick = {
      tacaItemId,
      displayName: item.displayName,
      displayPrice: item.displayPrice,
      originalPrice: item.originalPrice,
      discountRate: item.discountRate,
      shortUrl,
      ...(note ? { note } : store.picks[key]?.note ? { note: store.picks[key].note } : {}),
      checkedAt: kstToday(),
      ...(item.endAt ? { endAt: item.endAt } : {}),
    };
    store.picks[key] = pick;
    if (slotName) setSlot(slotName as TossSlot, key);
    writeStore(store);

    console.log(`저장 완료 — key '${key}'`);
    console.log(`  ${pick.displayName}`);
    console.log(`  ${pick.displayPrice.toLocaleString("ko-KR")}원 (${pick.discountRate}% 할인)`);
    console.log(`  ${pick.shortUrl}`);
    if (slotName) console.log(`  → '${slotName}' 자리에 걸렸다.`);
    console.log(`\n가이드 글 본문에 넣으려면 그 자리에 한 줄:\n  :::toss ${key}:::`);
  } catch (e) {
    const msg =
      e instanceof TossApiFailure ? `${e.errorCode} — ${explainError(e.errorCode)}` : (e as Error).message;
    console.error("실패:", msg);
    process.exit(1);
  }
}

main();
