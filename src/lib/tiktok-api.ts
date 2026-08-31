// src/lib/tiktok-api.ts
import fs from "node:fs";

const TIKTOK_API = "https://open.tiktokapis.com";
export const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = `${TIKTOK_API}/v2/oauth/token/`;
// 🔴 video.list / user.info.stats 는 **조회 전용** 스코프다 (2026-09-01 추가).
// 그전까지 우리 토큰은 게시만 가능해서, 몇 달째 조회수 0 인 걸 앱을 켜야만 알 수 있었다
// (작업57 에서 "틱톡은 API로 읽기 불가"로 기록된 그 자리). 이 스코프가 붙어야
// `npm run tiktok:stats` 가 게시물별 조회수를 읽는다.
// 🔴 스코프를 늘려도 **이미 발급된 토큰에는 소급 적용되지 않는다** — 사용자가
// `npm run tiktok:auth` 로 한 번 재인증해야 한다.
export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.stats",
  "video.publish",
  "video.upload",
  "video.list",
];
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

export interface CreatorInfo {
  creatorUsername?: string;
  creatorNickname?: string;
  privacyLevelOptions: string[];
  maxVideoPostDurationSec: number;
  /** creator_info가 상호작용을 막아둔 경우 → UI에서 해당 체크박스 비활성 (UX Guideline) */
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
}

export async function getCreatorInfo(accessToken: string): Promise<CreatorInfo> {
  const res = await fetch(`${TIKTOK_API}/v2/post/publish/creator_info/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
  const data = (await res.json()) as {
    data?: {
      creator_username?: string;
      creator_nickname?: string;
      privacy_level_options?: string[];
      max_video_post_duration_sec?: number;
      comment_disabled?: boolean;
      duet_disabled?: boolean;
      stitch_disabled?: boolean;
    };
    error?: { code?: string; message?: string };
  };
  if (!res.ok || !data.data) {
    throw new Error(`creator_info 조회 실패: ${JSON.stringify(data)}`);
  }
  return {
    creatorUsername: data.data.creator_username,
    creatorNickname: data.data.creator_nickname,
    privacyLevelOptions: data.data.privacy_level_options ?? [],
    maxVideoPostDurationSec: data.data.max_video_post_duration_sec ?? 60,
    commentDisabled: data.data.comment_disabled ?? false,
    duetDisabled: data.data.duet_disabled ?? false,
    stitchDisabled: data.data.stitch_disabled ?? false,
  };
}

export type PrivacyLevel = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";

export interface PostVideoParams {
  filePath: string;
  caption: string;
  privacyLevel: PrivacyLevel;
  disableDuet?: boolean;
  disableComment?: boolean;
  disableStitch?: boolean;
  /**
   * 영상에 AI 생성 이미지가 **실제로** 들어 있는가.
   *
   * 🔴 상수로 박지 말 것. 2026-06~08 내내 `true` 로 고정돼 있었는데, 그 라벨은
   * 붙이는 순간 되돌릴 수 없고 도달에도 불리하다(TikTok 공식 입장은 "라벨은 순위
   * 신호가 아니다"지만, 라벨된 AI 콘텐츠가 실제로 덜 퍼진다는 관측이 일관된다).
   * 반대로 AI 컷이 들어 있는데 안 붙이면 정책 위반이다. 그래서 **영상을 만든 쪽이
   * 사실을 넘겨준다**(manifest).
   */
  isAigc: boolean;
  /**
   * 이 영상이 **우리 사업(한해설)을 홍보**하는가.
   *
   * 🔴 TikTok 커뮤니티 가이드라인은 미표기 마케팅 콘텐츠를 For You 피드
   * **부적격**으로 명시한다. 우리 영상은 전부 아웃트로에서 "한해설 검색"을
   * 유도하므로 여기 해당하는데, 2026-06 게시 시작 이후 이 값을 한 번도 보내지
   * 않았다. 조회수가 처음부터 0 이었던 것과 시점이 맞는다.
   */
  brandOrganicToggle?: boolean;
}

interface InitResponse {
  publishId: string;
  uploadUrl: string;
}

async function initFileUpload(
  accessToken: string,
  p: PostVideoParams,
  videoSize: number,
  chunkSize: number,
  totalChunkCount: number,
): Promise<InitResponse> {
  const body = {
    post_info: {
      title: p.caption,
      privacy_level: p.privacyLevel,
      disable_duet: p.disableDuet ?? false,
      disable_comment: p.disableComment ?? false,
      disable_stitch: p.disableStitch ?? false,
      // 게시 후 변경 불가. 미부착 상태에서 자동 감지되면 정책 위반이므로
      // **AI 컷이 들어 있을 때만** 붙인다(사실을 영상 생성 쪽에서 받는다).
      is_aigc: p.isAigc,
      // 우리 사업 홍보 표기. 미표기 마케팅은 For You 피드 부적격이다.
      brand_organic_toggle: p.brandOrganicToggle ?? false,
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: videoSize,
      chunk_size: chunkSize,
      total_chunk_count: totalChunkCount,
    },
  };
  const res = await fetch(`${TIKTOK_API}/v2/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };
  if (!res.ok || !data.data?.publish_id || !data.data?.upload_url) {
    throw new Error(`업로드 init 실패: ${JSON.stringify(data)}`);
  }
  return { publishId: data.data.publish_id, uploadUrl: data.data.upload_url };
}

async function uploadChunk(
  uploadUrl: string,
  chunk: Buffer,
  contentRangeStart: number,
  contentRangeEnd: number,
  totalSize: number,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(chunk.length),
      "Content-Range": `bytes ${contentRangeStart}-${contentRangeEnd}/${totalSize}`,
    },
    body: new Uint8Array(chunk),
  });
  // TikTok은 206(중간 청크) 또는 201(마지막 청크 완료)을 반환
  if (res.status !== 206 && res.status !== 201 && res.status !== 200) {
    const text = await res.text();
    throw new Error(`청크 업로드 실패 (${contentRangeStart}-${contentRangeEnd}): ${res.status} ${text}`);
  }
}

type StatusFetchResponse = {
  data?: { status?: string; fail_reason?: string; publicaly_available_post_id?: string[] };
  error?: { code?: string; message?: string };
};

async function pollPublishStatus(
  accessToken: string,
  publishId: string,
  maxAttempts = 60,
  intervalMs = 3000,
): Promise<string[]> {
  for (let i = 0; i < maxAttempts; i++) {
    // 상태 조회 자체가 일시 오류(네트워크/5xx/internal_error)로 실패해도
    // 업로드는 이미 끝난 상태라 대개 다음 폴링에서 회복된다. 즉시 throw하지 말고 재시도.
    let data: StatusFetchResponse | null = null;
    try {
      const res = await fetch(`${TIKTOK_API}/v2/post/publish/status/fetch/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ publish_id: publishId }),
      });
      data = (await res.json()) as StatusFetchResponse;
      if (!res.ok || data?.error?.code === "internal_error") {
        console.warn(`⚠️ 상태 조회 일시 오류(재시도 ${i + 1}/${maxAttempts}): ${JSON.stringify(data)}`);
        await sleep(intervalMs);
        continue;
      }
    } catch (e) {
      console.warn(`⚠️ 상태 조회 네트워크 오류(재시도 ${i + 1}/${maxAttempts}): ${String(e)}`);
      await sleep(intervalMs);
      continue;
    }
    const status = data?.data?.status;
    // 공개 post ID(영상 URL 조립용). 0조회수 진단 때 게시 영상을 외부에서
    // 확인할 방법이 없었어서(로그에 publish_id만 남음) 같이 반환한다.
    if (status === "PUBLISH_COMPLETE") return data?.data?.publicaly_available_post_id ?? [];
    if (status === "FAILED") {
      throw new Error(`게시 실패: ${data?.data?.fail_reason ?? "알 수 없음"}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`상태 폴링 타임아웃 (${maxAttempts * intervalMs / 1000}s)`);
}

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export interface PostVideoResult {
  publishId: string;
  /** 공개 영상 post ID들 (publicaly_available_post_id). 비어있을 수 있음. */
  videoIds: string[];
}

export async function postVideoFileUpload(
  accessToken: string,
  p: PostVideoParams,
): Promise<PostVideoResult> {
  const stat = fs.statSync(p.filePath);
  const videoSize = stat.size;

  // 64MB 이하면 단일 청크 업로드 (TikTok 권장)
  const useSingleChunk = videoSize <= 64 * 1024 * 1024;
  const chunkSize = useSingleChunk ? videoSize : CHUNK_SIZE;
  const totalChunkCount = useSingleChunk ? 1 : Math.ceil(videoSize / CHUNK_SIZE);

  const { publishId, uploadUrl } = await initFileUpload(
    accessToken,
    p,
    videoSize,
    chunkSize,
    totalChunkCount,
  );
  console.log(`📤 업로드 init 완료. publish_id=${publishId}, ${totalChunkCount}개 청크`);

  if (useSingleChunk) {
    const buf = fs.readFileSync(p.filePath);
    await uploadChunk(uploadUrl, buf, 0, videoSize - 1, videoSize);
  } else {
    const fd = fs.openSync(p.filePath, "r");
    try {
      for (let i = 0; i < totalChunkCount; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, videoSize) - 1;
        const len = end - start + 1;
        const buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, start);
        await uploadChunk(uploadUrl, buf, start, end, videoSize);
        console.log(`   청크 ${i + 1}/${totalChunkCount} 완료 (${start}-${end})`);
      }
    } finally {
      fs.closeSync(fd);
    }
  }
  console.log(`📤 청크 업로드 완료. 게시 처리 대기 중...`);

  const videoIds = await pollPublishStatus(accessToken, publishId);
  return { publishId, videoIds };
}
