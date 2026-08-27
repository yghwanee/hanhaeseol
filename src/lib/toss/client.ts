import fs from "node:fs";
import path from "node:path";
import type { TossEnvelope, TossApiError, TossTokenResponse } from "./types";

/**
 * 토스쇼핑 쉐어링크 Open API 클라이언트.
 *
 * 🔴 이건 **서버 대 서버 전용**이다. Next 런타임(브라우저·엣지)에서 부르지 않는다.
 * ①Secret Key 가 노출되고 ②호출 서버의 **고정 IP 를 사전 등록**해야 하는데
 * Vercel 함수·GitHub Actions 는 나가는 IP 가 고정되지 않는다(아래 IP 항목 참조).
 *
 * 문서: https://sharelink-docs.toss.im/
 */

const TOKEN_URL = "https://oauth2.cert.toss.im/token";

/**
 * 문서가 Base URL 을 `https://sharelink.toss.im/openapi` 라고 적어 놓고 각 엔드포인트
 * 경로는 `/openapi/categories` 처럼 `/openapi` 를 다시 포함해 표기한다(둘 중 하나가 중복).
 * 인증이 라우팅보다 먼저 걸려서 401 만 돌아오므로 **경로만으로는 어느 쪽인지 못 가린다**
 * (2026-08-27 실측: `/openapi/categories`·`/openapi/openapi/categories` 둘 다 401).
 * 그래서 기본값을 호스트로 두고, 첫 실호출에서 404 가 나면 `toss:check` 가 알려 준다.
 * 환경변수로 덮어쓸 수 있게 해 둔다.
 */
const API_BASE = process.env.TOSS_SHARELINK_API_BASE ?? "https://sharelink.toss.im";

/** 발급 토큰은 약 1년짜리다. 매 호출마다 재발급하지 말라고 문서가 명시한다. */
const TOKEN_CACHE = path.resolve(".toss-sharelink-token.json");
/** 만료 직전 토큰으로 호출하다 실패하는 걸 막는 여유(1일). */
const TOKEN_SKEW_MS = 24 * 60 * 60 * 1000;

export const TOSS_SCOPES = "sharelink:read sharelink:write";

export interface TossEnv {
  accessKey: string;
  secretKey: string;
  publisherId: string;
}

/** 자격증명을 읽는다. 없으면 어떤 변수가 비었는지 정확히 알려 준다. */
export function tossEnv(): TossEnv {
  const accessKey = process.env.TOSS_SHARELINK_ACCESS_KEY ?? "";
  const secretKey = process.env.TOSS_SHARELINK_SECRET_KEY ?? "";
  const publisherId = process.env.TOSS_SHARELINK_PUBLISHER_ID ?? "";
  const missing = [
    !accessKey && "TOSS_SHARELINK_ACCESS_KEY",
    !secretKey && "TOSS_SHARELINK_SECRET_KEY",
    !publisherId && "TOSS_SHARELINK_PUBLISHER_ID",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `토스 쉐어링크 환경변수 없음: ${missing.join(", ")}\n` +
        "  → 쉐어링크 크리에이터 관리자에서 Access Key/Secret Key 발급 후 .env.local 에 넣을 것.",
    );
  }
  return { accessKey, secretKey, publisherId };
}

/** 자격증명이 다 있는지만 본다(없으면 기능을 조용히 끄는 경로용). */
export function hasTossEnv(): boolean {
  try {
    tossEnv();
    return true;
  } catch {
    return false;
  }
}

interface CachedToken {
  accessToken: string;
  /** epoch ms */
  expiresAt: number;
  scope: string;
  /** 어떤 Access Key 로 받은 토큰인지 — 키를 바꾸면 캐시를 버려야 한다. */
  accessKeyFingerprint: string;
}

/** Access Key 원문을 캐시 파일에 남기지 않으려고 앞 6자만 기록한다. */
function fingerprint(accessKey: string): string {
  return accessKey.slice(0, 6);
}

function readCachedToken(accessKey: string): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(TOKEN_CACHE, "utf8")) as CachedToken;
    if (raw.accessKeyFingerprint !== fingerprint(accessKey)) return null;
    if (raw.expiresAt - TOKEN_SKEW_MS <= Date.now()) return null;
    return raw.accessToken;
  } catch {
    return null;
  }
}

function writeCachedToken(accessKey: string, res: TossTokenResponse): void {
  const cached: CachedToken = {
    accessToken: res.access_token,
    expiresAt: Date.now() + res.expires_in * 1000,
    scope: res.scope,
    accessKeyFingerprint: fingerprint(accessKey),
  };
  fs.writeFileSync(TOKEN_CACHE, JSON.stringify(cached, null, 2) + "\n", "utf8");
}

/** 토큰 발급(client_credentials). 캐시가 살아 있으면 그걸 쓴다. */
export async function getAccessToken(opts: { force?: boolean } = {}): Promise<string> {
  const { accessKey, secretKey } = tossEnv();
  if (!opts.force) {
    const cached = readCachedToken(accessKey);
    if (cached) return cached;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: accessKey,
    client_secret: secretKey,
    scope: TOSS_SCOPES,
  });

  // fetch-cache-ok: 스크립트 전용(Next 런타임 아님) + 토큰 발급은 캐시 대상이 아니다.
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`토스 토큰 발급 실패 ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as TossTokenResponse;
  if (!json.access_token) throw new Error(`토큰 응답에 access_token 없음: ${text.slice(0, 300)}`);
  writeCachedToken(accessKey, json);
  return json.access_token;
}

export class TossApiFailure extends Error {
  constructor(
    readonly errorCode: string,
    readonly errorType: number,
    readonly reason: string | undefined,
    readonly httpStatus: number,
  ) {
    super(`[${errorCode}] ${reason ?? ""} (HTTP ${httpStatus})`);
    this.name = "TossApiFailure";
  }
}

/**
 * 에러코드별 사람이 읽을 안내. 코드만 던지면 다음에 또 문서를 뒤지게 된다.
 * 코드 목록은 문서 '공통 규약' 기준.
 */
export function explainError(errorCode: string): string {
  switch (errorCode) {
    case "SHARELINK_OPENAPI_ACCESS_DENIED":
      return "자격증명이 틀렸거나 **호출 서버 IP 가 미등록**이다. 관리자에서 나가는 IP 를 등록할 것(업체당 10개, /16~/32).";
    case "SHARELINK_OPENAPI_QUOTA_EXCEEDED":
      return "일일 쿼터 소진(상품 조회 10,000건 / 링크 발급 10,000건, KST 자정 리셋). 발급한 링크는 저장해 재사용할 것.";
    case "INVALID_ARGUMENT":
      return "파라미터가 잘못됐다(categoryId 오류 포함).";
    default:
      return "문서 '공통 규약'의 에러 코드 표를 확인할 것.";
  }
}

/** 인증 헤더를 붙여 호출하고 봉투를 벗겨 준다. FAIL 이면 TossApiFailure 를 던진다. */
export async function tossRequest<T>(
  apiPath: string,
  init: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(apiPath, API_BASE);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  // fetch-cache-ok: 스크립트 전용(Next 런타임 아님). 신선도는 호출부가 관리한다.
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  const text = await res.text();
  let json: TossEnvelope<T>;
  try {
    json = JSON.parse(text) as TossEnvelope<T>;
  } catch {
    throw new Error(`토스 응답 파싱 실패 ${res.status} ${url.pathname}: ${text.slice(0, 300)}`);
  }

  if (json.resultType === "FAIL") {
    const e: TossApiError = json.error;
    throw new TossApiFailure(e.errorCode, e.errorType, e.reason, res.status);
  }
  if (!res.ok) {
    throw new Error(`토스 API ${res.status} ${url.pathname}: ${text.slice(0, 300)}`);
  }
  return json.success;
}

export const TOSS_API_BASE = API_BASE;
export const TOSS_TOKEN_CACHE_PATH = TOKEN_CACHE;
