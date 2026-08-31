/**
 * 틱톡 게시물별 조회수를 읽는다.
 *
 * 🔴 왜 새로 만드나 (2026-09-01)
 * 몇 달째 "조회수가 0" 인데, 그걸 확인하는 유일한 방법이 사용자가 앱을 켜는 것이었다.
 * 우리 토큰에 조회 스코프가 없어서다(작업57 이 "틱톡은 API 로 읽기 불가"로 기록한 자리).
 * 고칠 때마다 효과를 못 재면 계속 추측만 하게 되므로, 재는 것부터 만든다.
 *
 * 🔴 이 스크립트는 **재인증 전에는 동작하지 않는다.** 스코프는 발급 시점에 토큰에
 * 박히므로, TIKTOK_SCOPES 에 video.list 를 추가한 것만으로는 기존 토큰이 안 바뀐다.
 * `npm run tiktok:setup` 을 한 번 다시 돌려 TIKTOK_REFRESH_TOKEN 을 갱신해야 한다.
 */
import { getAccessToken } from "@/lib/tiktok-api";

const FIELDS = [
  "id",
  "title",
  "create_time",
  "view_count",
  "like_count",
  "comment_count",
  "share_count",
  "share_url",
].join(",");

interface TikTokVideo {
  id: string;
  title?: string;
  create_time?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  share_url?: string;
}

export async function fetchTiktokVideos(accessToken: string, maxCount = 20) {
  // fetch-cache-ok: GH Actions·로컬 전용 스크립트라 Next 런타임 캐시와 무관하다.
  const res = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${FIELDS}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ max_count: maxCount }),
  });
  const data = (await res.json()) as {
    data?: { videos?: TikTokVideo[] };
    error?: { code?: string; message?: string };
  };
  if (data.error && data.error.code !== "ok") {
    const code = data.error.code ?? "unknown";
    if (code === "scope_not_authorized" || code === "scope_permission_missed") {
      throw new Error(
        `토큰에 video.list 스코프가 없습니다 (${code}).\n` +
          `   → npm run tiktok:setup 으로 한 번 재인증하고, 새 refresh token 을\n` +
          `     .env.local 과 GitHub Secret(TIKTOK_REFRESH_TOKEN) 양쪽에 넣으세요.`,
      );
    }
    throw new Error(`video.list 실패: ${code} ${data.error.message ?? ""}`);
  }
  return data.data?.videos ?? [];
}

async function main() {
  const { accessToken } = await getAccessToken();
  const videos = await fetchTiktokVideos(accessToken);

  if (videos.length === 0) {
    console.log("게시물이 없습니다(또는 조회 권한 밖).");
    return;
  }

  let sum = 0;
  console.log(`\n📊 틱톡 최근 게시물 ${videos.length}건\n`);
  for (const v of videos) {
    const when = v.create_time
      ? new Date(v.create_time * 1000).toISOString().slice(0, 16).replace("T", " ")
      : "?";
    const views = v.view_count ?? 0;
    sum += views;
    const title = (v.title ?? "").split("\n")[0].slice(0, 34);
    console.log(
      `  ${when}  조회 ${String(views).padStart(6)}  ` +
        `♥${String(v.like_count ?? 0).padStart(4)}  ${title}`,
    );
  }
  const avg = Math.round(sum / videos.length);
  console.log(`\n  합계 ${sum} · 평균 ${avg}`);
  // 이게 이 스크립트를 만든 이유다 — 0 이면 배포가 안 되고 있다는 뜻이고,
  // 그건 코드가 아니라 계정 상태(추천 부적격 표시)를 봐야 하는 신호다.
  if (sum === 0) {
    console.log(
      `\n🔴 전부 0 입니다. 게시는 되지만 배포가 안 되고 있다는 뜻입니다.\n` +
        `   앱에서 [설정 → 계정 → 계정 상태] 와 영상별 "추천 부적격" 표시를 확인하세요.`,
    );
  }
}

if (process.argv[1]?.endsWith("check-tiktok-stats.ts")) {
  main().catch((e) => {
    console.error(`❌ ${(e as Error).message}`);
    process.exitCode = 1;
  });
}
