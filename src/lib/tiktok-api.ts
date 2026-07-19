// src/lib/tiktok-api.ts
import fs from "node:fs";

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
      // AI 합성 이미지(ChatGPT 생성 후킹 컷)가 영상에 포함됨.
      // 게시 후 변경 불가. 미부착 상태에서 자동 감지되면 정책 위반.
      is_aigc: true,
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
