import { tossRequest, tossEnv } from "./client";
import type {
  TossCategory,
  TossPagedProducts,
  TossProductDetail,
  TossShareLink,
} from "./types";

/**
 * 쉐어링크 Open API 엔드포인트.
 * 경로는 문서 표기 그대로 `/openapi/...` 를 쓴다(base = 호스트).
 */

/** 카테고리 트리. 파라미터 없음. */
export function getCategories(): Promise<{ categories: TossCategory[] }> {
  return tossRequest("/openapi/categories");
}

/** 카테고리별 베스트 상품. size 1~100(기본 30). */
export function getCategoryBest(
  categoryId: number,
  opts: { cursor?: string; size?: number } = {},
): Promise<TossPagedProducts> {
  return tossRequest(`/openapi/products/best-categories/${categoryId}`, { query: opts });
}

/** 전체 베스트 상품. size 1~100(기본 30). */
export function getBestSelling(
  opts: { cursor?: string; size?: number } = {},
): Promise<TossPagedProducts> {
  return tossRequest("/openapi/products/best-selling", { query: opts });
}

/** 하루특가. size 1~30(기본 30). endAt 로 마감 시각이 온다. */
export function getTodayDeals(
  opts: { cursor?: string; size?: number } = {},
): Promise<TossPagedProducts> {
  return tossRequest("/openapi/products/today-deals", { query: opts });
}

/** 상품 상세. tacaItemIds 또는 tacaIds 중 하나(콤마 구분, 최대 30건). */
export function getProductDetail(
  ids: { tacaItemIds?: number[]; tacaIds?: number[] },
): Promise<{ items: TossProductDetail[]; notFoundIds: number[] }> {
  if (!ids.tacaItemIds?.length && !ids.tacaIds?.length) {
    throw new Error("상품 상세 조회에 tacaItemIds 나 tacaIds 중 하나는 필요하다");
  }
  return tossRequest("/openapi/products/detail", {
    query: {
      tacaItemIds: ids.tacaItemIds?.join(","),
      tacaIds: ids.tacaIds?.join(","),
    },
  });
}

/**
 * 쉐어링크 발급.
 *
 * 🔴 같은 (tacaItemId, publisherId) 조합은 **항상 같은 링크**를 돌려준다. 그래서
 * 발급 결과를 저장해 재사용해야 한다 — 매번 부르면 일일 쿼터(10,000건)만 태운다.
 * 🔴 상품 목록이 주는 `productUrl` 은 추적이 안 붙어 수익이 안 잡힌다. 반드시 이걸로 받은
 * `shortUrl`(또는 `originUrl`)을 쓸 것.
 */
export function createShareLink(tacaItemId: number): Promise<TossShareLink> {
  const { publisherId } = tossEnv();
  return tossRequest("/openapi/links", {
    method: "POST",
    body: { tacaItemId, publisherId },
  });
}
