// src/scripts/post-tiktok.ts
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { getKstToday } from "@/lib/instagram";
import { buildCaption } from "@/lib/instagram-api";
import { OUT_DIR, readManifest } from "@/lib/manifest";
import { UTM_LINKS } from "@/lib/utm";
import {
  getAccessToken,
  getCreatorInfo,
  postVideoFileUpload,
  type PrivacyLevel,
} from "@/lib/tiktok-api";

function resolvePrivacyLevel(): PrivacyLevel {
  const v = process.env.TIKTOK_PRIVACY_LEVEL;
  if (v === "PUBLIC_TO_EVERYONE" || v === "MUTUAL_FOLLOW_FRIENDS" || v === "SELF_ONLY") {
    return v;
  }
  return "SELF_ONLY"; // 심사 통과 전 기본값
}

/**
 * 회전(rotation)된 refresh token을 GitHub Secrets에 자동 갱신.
 * GH_PAT_SECRETS_WRITE 시크릿(secrets:write 권한 PAT)이 있어야 동작.
 * 없으면 경고만 로그하고 통과 (다음 실행 때 토큰 만료로 실패할 가능성).
 */
function persistRotatedRefreshToken(oldToken: string, newToken: string) {
  if (oldToken === newToken) {
    console.log(`🔁 refresh token 회전 없음`);
    return;
  }
  const ghPat = process.env.GH_PAT_SECRETS_WRITE;
  if (!ghPat) {
    console.warn(
      `⚠️ refresh token이 회전되었지만 GH_PAT_SECRETS_WRITE가 없어 자동 갱신 불가.`,
    );
    console.warn(`   다음 실행 전에 수동으로 TIKTOK_REFRESH_TOKEN을 다음 값으로 갱신:`);
    console.warn(`   ${newToken}`);
    return;
  }
  try {
    execFileSync("gh", ["secret", "set", "TIKTOK_REFRESH_TOKEN", "--body", newToken], {
      stdio: "inherit",
      env: { ...process.env, GH_TOKEN: ghPat },
    });
    console.log(`🔁 refresh token 회전 → GitHub Secret 자동 갱신 완료`);
  } catch (e) {
    console.error(`❌ Secret 갱신 실패. 수동 갱신 필요:`, (e as Error).message);
    console.error(`   (새 토큰 값은 보안상 로그에 출력 안 함 — workflow run logs 보호)`);
  }
}

async function main() {
  const manifest = readManifest();
  if (!manifest.reel) {
    throw new Error("매니페스트에 reel 필드 없음 — 먼저 reel:make 실행 필요");
  }
  const filePath = path.join(OUT_DIR, manifest.reel);
  if (!fs.existsSync(filePath)) {
    throw new Error(`영상 파일 없음: ${filePath}`);
  }

  const sizeMb = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
  const { today, mm, dd } = getKstToday();
  const caption = `${buildCaption(mm, dd, today, UTM_LINKS.tt_caption)}\n#fyp #포유`;
  const privacyLevel = resolvePrivacyLevel();

  console.log(`🎵 TikTok 업로드 시작 (${sizeMb} MB)`);
  console.log(`   privacy_level: ${privacyLevel}`);

  const oldRefreshToken = process.env.TIKTOK_REFRESH_TOKEN!;
  const { accessToken, refreshToken: newRefreshToken } = await getAccessToken();

  // 회전 즉시 영속화 — 게시 실패해도 다음 실행에서 새 토큰 사용 가능
  persistRotatedRefreshToken(oldRefreshToken, newRefreshToken);

  // creator_info는 best-effort (실패해도 게시는 시도)
  try {
    const info = await getCreatorInfo(accessToken);
    console.log(
      `   계정: @${info.creatorUsername ?? "?"} (${info.creatorNickname ?? "?"}) ` +
        `max ${info.maxVideoPostDurationSec}s, options=[${info.privacyLevelOptions.join(",")}]`,
    );
    if (!info.privacyLevelOptions.includes(privacyLevel)) {
      console.warn(
        `⚠️ 요청한 privacy_level '${privacyLevel}'이 계정 허용 목록에 없음. ` +
          `허용: [${info.privacyLevelOptions.join(",")}]. 그래도 시도함.`,
      );
    }
  } catch (e) {
    console.warn(`⚠️ creator_info 조회 실패 (무시하고 진행):`, (e as Error).message);
  }

  const publishId = await postVideoFileUpload(accessToken, {
    filePath,
    caption,
    privacyLevel,
    disableDuet: false,
    disableComment: false,
    disableStitch: false,
  });

  console.log(`✅ TikTok 업로드 완료. publish_id=${publishId}`);
  if (privacyLevel === "SELF_ONLY") {
    console.log(`   (비공개 모드 — 본인 계정에서만 보임. 심사 통과 후 PUBLIC_TO_EVERYONE으로 변경)`);
  }
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
