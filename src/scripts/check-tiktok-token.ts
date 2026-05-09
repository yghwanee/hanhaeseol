// src/scripts/check-tiktok-token.ts
import "dotenv/config";

async function main() {
  const required = ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ 누락된 환경변수: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`✅ TikTok 환경변수 확인 (CLIENT_KEY, CLIENT_SECRET, REFRESH_TOKEN)`);
  console.log(`   ※ 실제 토큰 유효성은 post:tiktok 단계에서 refresh 호출로 검증됨`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
