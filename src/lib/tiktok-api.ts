// src/lib/tiktok-api.ts

const TIKTOK_API = "https://open.tiktokapis.com";
export const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = `${TIKTOK_API}/v2/oauth/token/`;
export const TIKTOK_SCOPES = ["user.info.basic", "video.publish", "video.upload"];
export const TIKTOK_REDIRECT_URI = "https://haeseol.com/api/tiktok/callback";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} 환경변수가 필요합니다.`);
  return v;
}

export function tiktokEnv() {
  return {
    clientKey: env("TIKTOK_CLIENT_KEY"),
    clientSecret: env("TIKTOK_CLIENT_SECRET"),
    refreshToken: env("TIKTOK_REFRESH_TOKEN"),
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface TokenResponse {
  accessToken: string;
  /** TikTok이 새 refresh token을 발급할 수 있음 (회전). 같은 값일 수도 있음 */
  refreshToken: string;
  /** access token 유효 기간 (초) */
  expiresIn: number;
}

export async function getAccessToken(): Promise<TokenResponse> {
  const { clientKey, clientSecret, refreshToken } = tiktokEnv();
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error(`TikTok access_token 갱신 실패: ${JSON.stringify(data)}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 86400,
  };
}
