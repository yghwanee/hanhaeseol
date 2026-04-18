import "dotenv/config";
import { getChannelInfo } from "@/lib/youtube-api";

async function main() {
  const required = ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"];
  for (const k of required) {
    if (!process.env[k]) {
      console.error(`❌ ${k} 환경변수가 없습니다.`);
      process.exit(1);
    }
  }
  const info = await getChannelInfo();
  console.log(`✅ YouTube 토큰 정상. 연결된 채널: ${info.title} (ID: ${info.id})`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
