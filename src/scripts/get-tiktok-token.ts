// src/scripts/get-tiktok-token.ts
/**
 * TikTok refresh token 발급 (로컬 최초 1회)
 *
 * 흐름:
 *   1) 콘솔에 authorize URL 출력
 *   2) 브라우저로 열어 TikTok 로그인 + Authorize
 *   3) https://haeseol.com/api/tiktok/callback 페이지에 표시되는 code 복사
 *   4) 터미널 stdin에 붙여넣기
 *   5) refresh_token이 콘솔에 출력됨 → GitHub Secrets에 등록
 */
import "dotenv/config";
import readline from "node:readline/promises";
import crypto from "node:crypto";
import {
  TIKTOK_AUTH_URL,
  TIKTOK_TOKEN_URL,
  authorizeScopes,
  TIKTOK_REDIRECT_URI,
} from "@/lib/tiktok-api";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`❌ ${key} 환경변수가 필요합니다. .env에 추가해주세요.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const clientKey = requireEnv("TIKTOK_CLIENT_KEY");
  const clientSecret = requireEnv("TIKTOK_CLIENT_SECRET");
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = new URL(TIKTOK_AUTH_URL);
  authUrl.searchParams.set("client_key", clientKey);
  authUrl.searchParams.set("scope", authorizeScopes().join(","));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", TIKTOK_REDIRECT_URI);
  authUrl.searchParams.set("state", state);

  console.log("\n👉 아래 URL을 브라우저에서 열고 TikTok 로그인 + Authorize 클릭:\n");
  console.log(authUrl.toString());
  console.log(`\n🔑 state (검증용): ${state}\n`);
  console.log(`📋 Authorize 후 ${TIKTOK_REDIRECT_URI} 페이지에 표시되는 code를 복사하세요.`);
  console.log(`   (페이지에 표시된 state가 위 값과 같은지 확인할 것)\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question("👉 code 붙여넣기: ")).trim();
  rl.close();

  if (!code) {
    console.error("❌ code 입력 안 됨");
    process.exit(1);
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: TIKTOK_REDIRECT_URI,
  });
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    open_id?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.refresh_token) {
    console.error("❌ refresh_token 발급 실패:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ TIKTOK_REFRESH_TOKEN =");
  console.log(data.refresh_token);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  if (data.open_id) console.log(`   연결된 open_id: ${data.open_id}`);
  console.log("📌 위 값을 GitHub Secrets에 TIKTOK_REFRESH_TOKEN으로 등록하세요.\n");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
