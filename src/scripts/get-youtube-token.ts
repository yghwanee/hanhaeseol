/**
 * YouTube Refresh Token 발급 스크립트 (로컬 최초 1회 실행)
 *
 * 사전 준비:
 *   1) Google Cloud Console 에서 "데스크톱 앱" OAuth 클라이언트 ID 생성
 *   2) .env 또는 환경변수에 YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET 세팅
 *
 * 실행:
 *   npm run yt:setup
 *
 * 흐름:
 *   - 로컬 http 서버를 띄움 (http://127.0.0.1:53682)
 *   - Google 로그인 URL 출력 → 브라우저에서 로그인 → 권한 동의
 *   - 리디렉션으로 auth code 수신 → refresh_token 으로 교환 → 콘솔 출력
 *   - 출력된 YOUTUBE_REFRESH_TOKEN 값을 GitHub Secrets 에 등록
 */

import "dotenv/config";
import http from "node:http";
import { URL } from "node:url";
import { YOUTUBE_SCOPES } from "@/lib/youtube-api";

const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`❌ ${key} 환경변수가 필요합니다. .env 파일에 추가해주세요.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const clientId = requireEnv("YOUTUBE_CLIENT_ID");
  const clientSecret = requireEnv("YOUTUBE_CLIENT_SECRET");

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  console.log("\n👉 아래 URL을 브라우저에서 열어 로그인 / 권한 동의 하세요:\n");
  console.log(authUrl.toString());
  console.log("\n (리디렉션 이후 터미널에 refresh token 이 출력됩니다)\n");

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const reqUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
      if (reqUrl.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const code = reqUrl.searchParams.get("code");
      const error = reqUrl.searchParams.get("error");
      if (error) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`❌ 인증 실패: ${error}`);
        server.close();
        reject(new Error(error));
        return;
      }
      if (!code) {
        res.writeHead(400).end("code 파라미터 없음");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<h2>✅ 인증 완료</h2><p>터미널로 돌아가 refresh token 을 확인하세요. 창을 닫아도 됩니다.</p>`,
      );
      server.close();
      resolve(code);
    });
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`⏳ 리디렉션 대기 중... (http://127.0.0.1:${PORT}/callback)\n`);
    });
    server.on("error", reject);
  });

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as { refresh_token?: string; access_token?: string; error?: string };
  if (!res.ok || !data.refresh_token) {
    console.error("❌ refresh token 발급 실패:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ YOUTUBE_REFRESH_TOKEN =");
  console.log(data.refresh_token);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("📌 위 값을 GitHub Secrets 에 YOUTUBE_REFRESH_TOKEN 으로 저장하세요.");
  console.log("   (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET 도 함께 등록 필요)\n");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
