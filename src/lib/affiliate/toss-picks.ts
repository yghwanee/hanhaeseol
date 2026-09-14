/**
 * 토스쇼핑 쉐어링크 — **화면 쪽** 모듈.
 *
 * 🔴 여기는 `src/lib/toss/`(Open API 클라이언트)와 일부러 갈라 놓은 자리다.
 * API 클라이언트는 Secret Key 와 고정 IP 가 필요한 **서버 대 서버 전용**이라
 * `src/app` 에서 import 하면 가드(`test:toss`)가 막는다. 화면이 필요한 건 이미
 * 발급받아 저장해 둔 값뿐이므로, 그 값만 다루는 이 모듈을 따로 둔다.
 *
 * 흐름:
 *   1. 이 PC 에서 `npm run toss:pick -- <tacaItemId>` → 상품 정보 + shortUrl 을
 *      `src/data/toss-picks.json` 에 저장하고 커밋한다.
 *   2. 빌드 시점에 그 JSON 을 읽어 정적으로 렌더한다(런타임 호출 0회).
 *
 * 🔴 런타임에 토스를 부르지 않는 이유가 두 개다. ①호출 IP 를 사전 등록해야 하는데
 * Vercel 함수는 나가는 IP 가 고정이 아니다 ②Vercel 이 Hobby 라 FOT·Active CPU·ISR
 * 쓰기가 이미 한도다. 상품 데이터는 커밋된 JSON 으로 나간다.
 */
import picksData from "@/data/toss-picks.json";

/**
 * 저장하는 상품 정보. 🔴 **이미지 관련 필드를 일부러 두지 않는다.**
 * 토스 운영정책이 "이미지 URL 을 외부 앱·사이트에서 직접 표시", "추천 영역·썸네일로
 * 반복 노출", "여러 상품의 이미지와 쉐어링크 자동 연동", "Open API 데이터로 별도 상품 DB
 * 구성"을 **사전 확인 대상**으로 명시한다. 텍스트만 쓰면 네 항목을 전부 비켜간다.
 * 썸네일을 넣고 싶으면 고객센터 확인을 먼저 받을 것 — 위반은 수익 정지·계약 해지다.
 */
export interface TossPick {
  tacaItemId: number;
  displayName: string;
  /** 할인 적용가(원) */
  displayPrice: number;
  /** 정가(원). displayPrice 와 같으면 할인 표기를 생략한다. */
  originalPrice: number;
  /** 할인율(%) */
  discountRate: number;
  /** 🔴 추적 링크. 목록이 주는 productUrl 은 추적이 안 붙어 수익이 안 잡힌다. */
  shortUrl: string;
  /** 사람이 쓴 한 줄 소개(선택). 상품 설명을 그대로 베끼지 말 것. */
  note?: string;
  /** 가격을 마지막으로 확인한 날 (YYYY-MM-DD, KST) */
  checkedAt: string;
  /** 하루특가면 마감 시각(ISO). 없으면 상시 상품. */
  endAt?: string;
}

export interface TossPicksStore {
  lastUpdated: string | null;
  /** 홈 띠배너에 쓸 pick 키. null 이면 홈에는 아무것도 안 뜬다. */
  deal: string | null;
  picks: Record<string, TossPick>;
}

const store = picksData as TossPicksStore;

/**
 * 🔴 대가성 문구. 표시광고법 사안이라 협상 대상이 아니고, 문구도 토스 문서의 것을
 * 그대로 쓴다. `#ad`·`제휴 링크` 처럼 **경제적 이해관계가 드러나지 않는 표현만**
 * 쓰는 것은 정책이 명시적으로 금지한다.
 *
 * 위치 규칙도 같이 지킨다 — 상품 소개를 보는 **그 시점에 같이 보여야** 한다.
 * 접힘·더보기·푸터·별도 페이지에 두면 위반이다. 그래서 두 지면 모두 카드 안에 박는다.
 */
export const DISCLOSURE_FULL =
  "이 콘텐츠는 토스쇼핑 쉐어링크 활동의 일환으로, 링크를 통한 구매가 발생하면 일정 수수료를 지급받습니다.";
export const DISCLOSURE_SHORT =
  "[광고] 토스쇼핑 쉐어링크 활동으로, 링크 구매 시 수수료를 지급받습니다.";

/**
 * 한 지면에 노출하는 상품 수 상한.
 *
 * 🔴 1 인 것에 이유가 있다. 토스 운영정책은 "API 로 받은 상품 가격을 DB 에 쌓아 두고
 * 이커머스 사이트처럼 **나열·전시**하는 커머스형 웹사이트는 승인되지 않습니다"라고 적는다.
 * 한해설은 편성표 사이트지 상품 목록 사이트가 아니다. 그리드를 키우는 순간 그 선을 넘는다.
 */
export const MAX_PICKS_PER_PLACEMENT = 1;

/**
 * 가격을 다시 확인하지 않은 채 며칠까지 표시할 것인가.
 *
 * 🔴 이건 디자인이 아니라 표시광고법 문제다. 토스 가격은 수시로 바뀌는데 우리는 빌드
 * 시점 스냅샷을 보여 준다. 낡은 값을 계속 띄우면 실제와 다른 가격을 광고하는 게 된다.
 * 그래서 상한을 넘으면 **가격을 숨기고 상품명과 링크만** 낸다(카드 자체는 살려 둔다).
 * 갱신은 `npm run toss:refresh`.
 */
export const PRICE_STALE_DAYS = 14;

/** KST 기준 오늘 (YYYY-MM-DD). 데이터의 checkedAt 과 같은 기준이어야 한다. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** checkedAt 이 PRICE_STALE_DAYS 를 넘겼나. 날짜가 이상하면 안전한 쪽(낡음)으로 본다. */
export function isPriceStale(checkedAt: string, today: string = kstToday()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)) return true;
  const days = (Date.parse(today) - Date.parse(checkedAt)) / 86_400_000;
  if (!Number.isFinite(days)) return true;
  return days > PRICE_STALE_DAYS;
}

/** 하루특가 마감이 지났나. 지난 상품은 지면에서 뺀다(없는 특가를 광고하게 된다). */
export function isExpired(pick: TossPick, now: Date = new Date()): boolean {
  if (!pick.endAt) return false;
  const t = Date.parse(pick.endAt);
  return Number.isFinite(t) && t <= now.getTime();
}

/** 12,900 → "12,900원" */
export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 키로 하나 꺼낸다. 없거나 마감된 상품이면 null — 호출부는 그냥 아무것도 안 그린다. */
export function getPick(key: string, now: Date = new Date()): TossPick | null {
  const pick = store.picks?.[key];
  if (!pick || !pick.shortUrl) return null;
  if (isExpired(pick, now)) return null;
  return pick;
}

/** 홈 띠배너용. `deal` 이 비어 있으면 홈에는 아무것도 안 뜬다(기본값 = 꺼짐). */
export function getDealPick(now: Date = new Date()): TossPick | null {
  if (!store.deal) return null;
  return getPick(store.deal, now);
}

/** 화면이 실제로 그릴 값. 가격이 낡았으면 가격 쪽만 떨군다. */
export interface TossPickView {
  pick: TossPick;
  /** false 면 가격·할인율을 그리지 않는다. */
  showPrice: boolean;
}

export function toView(pick: TossPick, today: string = kstToday()): TossPickView {
  return { pick, showPrice: !isPriceStale(pick.checkedAt, today) };
}

export const TOSS_PICKS_STORE = store;
