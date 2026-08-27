/** 토스쇼핑 쉐어링크 Open API 응답 타입. 문서(sharelink-docs.toss.im) 필드명 그대로. */

/** 모든 응답은 이 봉투에 담겨 온다. HTTP 200 이어도 resultType 이 FAIL 일 수 있다. */
export type TossEnvelope<T> =
  | { resultType: "SUCCESS"; success: T }
  | { resultType: "FAIL"; error: TossApiError };

export interface TossApiError {
  errorCode: string;
  errorType: number;
  reason?: string;
}

export interface TossTokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
  /** 초 단위. 실측 기준 약 1년(31,535,999). */
  expires_in: number;
}

export interface TossCategory {
  categoryId: number;
  level: number;
  displayName: string;
  children: TossCategory[];
}

/** 목록 API 공통 상품 필드. 상세 조회는 여기에 필드가 더 붙는다. */
export interface TossProduct {
  rank?: number;
  tacaItemId: number;
  displayName: string;
  thumbnailUrl: string;
  /** 🔴 추적 안 되는 일반 링크 — 이걸 쓰면 수익이 안 잡힌다. 링크는 /openapi/links 로 발급받을 것. */
  productUrl: string;
  displayPrice: number;
  originalPrice: number;
  discountRate: number;
  isSoldOut: boolean;
  reviewScore?: number;
  reviewCount?: number;
  categoryIds?: number[];
  /** 하루특가에만 있다. */
  endAt?: string;
}

export interface TossProductDetail extends TossProduct {
  tacaId: number;
  mainImageUrls: string[];
  description: {
    detailImageUrls: string[];
    noticeImageUrl: string | null;
    htmlUrl: string | null;
  };
}

export interface TossPagedProducts {
  items: TossProduct[];
  nextCursor: string | null;
  hasNext: boolean;
  category?: { categoryId: number; displayName: string };
}

export interface TossShareLink {
  tacaItemId: number;
  publisherId: string;
  /** 게시물에 쓰는 추적 단축 링크. */
  shortUrl: string;
  /** 단축하지 않은 추적 링크. shortUrl 과 추적 효과는 같다. */
  originUrl: string;
}
