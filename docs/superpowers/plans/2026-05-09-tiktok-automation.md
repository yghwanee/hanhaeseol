# TikTok 자동 게시 추가 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 KST 18:18 GitHub Actions 워크플로우의 한 단계로 한해설 브랜드 TikTok 계정에 reel.mp4를 자동 업로드한다. 심사 통과 전에는 비공개 가시성으로 게시.

**Architecture:** TikTok Content Posting API의 `FILE_UPLOAD` 방식. OAuth 2.0 refresh token으로 access token 갱신, 청크 PUT으로 영상 업로드, 상태 폴링으로 게시 완료 확인. 회전(rotation)된 refresh token은 `gh` CLI로 GitHub Secrets에 자동 갱신.

**Tech Stack:** TypeScript, tsx, Next.js 14 API routes (콜백은 이미 구현·배포됨), GitHub Actions, `gh` CLI, fetch API.

**선결 조건 (이미 완료):**
- ✅ TikTok Developer 앱 생성, Login Kit + Content Posting API 설정
- ✅ 도메인 검증 (haeseol.com TXT 레코드)
- ✅ Redirect URI: `https://haeseol.com/api/tiktok/callback` 등록
- ✅ 콜백 라우트 (`src/app/api/tiktok/callback/route.ts`) 배포 완료
- ✅ GitHub Secrets에 `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` 등록

**파일 구조:**
- 신규: `src/lib/tiktok-api.ts` — OAuth, 업로드, 상태 폴링, 시크릿 회전
- 신규: `src/scripts/check-tiktok-token.ts` — 환경변수 + 토큰 헬스체크
- 신규: `src/scripts/get-tiktok-token.ts` — 1회용 OAuth 인증 헬퍼
- 신규: `src/scripts/post-tiktok.ts` — 게시 진입점
- 수정: `package.json` — scripts 항목 3개 추가
- 수정: `.github/workflows/instagram.yml` — env 추가, 헬스체크/업로드 단계 추가, 텔레그램 메시지 변경
- (이미 존재) `src/app/api/tiktok/callback/route.ts`

---

## Task 1: tiktok-api.ts 골격 + 환경변수 헬퍼

**Files:**
- Create: `src/lib/tiktok-api.ts`

- [ ] **Step 1: 새 파일 생성**

```ts
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
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없이 종료

- [ ] **Step 3: 커밋**

```bash
git add src/lib/tiktok-api.ts
git commit -m "feat(tiktok): tiktok-api.ts 골격 + 환경변수 헬퍼"
```

---

## Task 2: getAccessToken 구현 (회전된 refresh token도 함께 반환)

**Files:**
- Modify: `src/lib/tiktok-api.ts`

- [ ] **Step 1: getAccessToken 추가**

`src/lib/tiktok-api.ts`의 끝에 추가:

```ts
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
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없이 종료

- [ ] **Step 3: 커밋**

```bash
git add src/lib/tiktok-api.ts
git commit -m "feat(tiktok): getAccessToken 구현 (refresh token rotation 지원)"
```

---

## Task 3: creator info 조회 함수

**Files:**
- Modify: `src/lib/tiktok-api.ts`

TikTok이 게시 전 creator_info 조회를 권장 (계정 게시 가능 상태 확인용). 실패해도 게시는 시도하도록 best-effort로 호출.

- [ ] **Step 1: getCreatorInfo 추가**

`src/lib/tiktok-api.ts`의 끝에 추가:

```ts
export interface CreatorInfo {
  creatorUsername?: string;
  creatorNickname?: string;
  privacyLevelOptions: string[];
  maxVideoPostDurationSec: number;
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
  };
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없이 종료

- [ ] **Step 3: 커밋**

```bash
git add src/lib/tiktok-api.ts
git commit -m "feat(tiktok): getCreatorInfo (게시 전 계정 상태 조회)"
```

---

## Task 4: 영상 업로드 (init + 청크 PUT + 상태 폴링)

**Files:**
- Modify: `src/lib/tiktok-api.ts`

- [ ] **Step 1: PostVideoParams 타입 + init 함수**

`src/lib/tiktok-api.ts`의 끝에 추가:

```ts
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
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없이 종료

- [ ] **Step 3: 청크 PUT 업로드 함수**

`src/lib/tiktok-api.ts`의 끝에 추가:

```ts
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
```

- [ ] **Step 4: 상태 폴링 함수**

`src/lib/tiktok-api.ts`의 끝에 추가:

```ts
async function pollPublishStatus(
  accessToken: string,
  publishId: string,
  maxAttempts = 60,
  intervalMs = 3000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${TIKTOK_API}/v2/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = (await res.json()) as {
      data?: { status?: string; fail_reason?: string; publicaly_available_post_id?: string[] };
      error?: { code?: string; message?: string };
    };
    if (!res.ok) {
      throw new Error(`상태 조회 실패: ${JSON.stringify(data)}`);
    }
    const status = data.data?.status;
    if (status === "PUBLISH_COMPLETE") return;
    if (status === "FAILED") {
      throw new Error(`게시 실패: ${data.data?.fail_reason ?? "알 수 없음"}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`상태 폴링 타임아웃 (${maxAttempts * intervalMs / 1000}s)`);
}
```

- [ ] **Step 5: postVideoFileUpload 통합 함수**

`src/lib/tiktok-api.ts`의 끝에 추가:

```ts
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export async function postVideoFileUpload(
  accessToken: string,
  p: PostVideoParams,
): Promise<string> {
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

  await pollPublishStatus(accessToken, publishId);
  return publishId;
}
```

- [ ] **Step 6: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없이 종료

- [ ] **Step 7: 커밋**

```bash
git add src/lib/tiktok-api.ts
git commit -m "feat(tiktok): 영상 업로드 (init + 청크 PUT + 상태 폴링)"
```

---

## Task 5: 토큰 헬스체크 스크립트

토큰 회전을 피하기 위해 환경변수 존재만 검증 (refresh 호출 안 함). 실제 토큰 유효성은 post-tiktok.ts 실행 시점에 검증됨.

**Files:**
- Create: `src/scripts/check-tiktok-token.ts`

- [ ] **Step 1: 새 파일 생성**

```ts
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
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없이 종료

- [ ] **Step 3: 커밋**

```bash
git add src/scripts/check-tiktok-token.ts
git commit -m "feat(tiktok): 토큰 환경변수 헬스체크 스크립트"
```

---

## Task 6: 1회용 OAuth refresh token 발급 스크립트

**Files:**
- Create: `src/scripts/get-tiktok-token.ts`

- [ ] **Step 1: 새 파일 생성**

```ts
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
  TIKTOK_SCOPES,
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
  authUrl.searchParams.set("scope", TIKTOK_SCOPES.join(","));
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
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없이 종료

- [ ] **Step 3: 커밋**

```bash
git add src/scripts/get-tiktok-token.ts
git commit -m "feat(tiktok): 1회용 OAuth refresh token 발급 스크립트"
```

---

## Task 7: 게시 진입점 스크립트 (회전된 refresh token 자동 갱신 포함)

**Files:**
- Create: `src/scripts/post-tiktok.ts`

- [ ] **Step 1: 새 파일 생성**

```ts
// src/scripts/post-tiktok.ts
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { getKstToday } from "@/lib/instagram";
import { buildCaption } from "@/lib/instagram-api";
import { OUT_DIR, readManifest } from "@/lib/manifest";
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
    execSync(`gh secret set TIKTOK_REFRESH_TOKEN --body "${newToken}"`, {
      stdio: "inherit",
      env: { ...process.env, GH_TOKEN: ghPat },
    });
    console.log(`🔁 refresh token 회전 → GitHub Secret 자동 갱신 완료`);
  } catch (e) {
    console.error(`❌ Secret 갱신 실패. 수동 갱신 필요:`, (e as Error).message);
    console.error(`   새 TIKTOK_REFRESH_TOKEN: ${newToken}`);
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
  const caption = `${buildCaption(mm, dd, today)}\n#fyp #포유`;
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
```

- [ ] **Step 2: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없이 종료

- [ ] **Step 3: 커밋**

```bash
git add src/scripts/post-tiktok.ts
git commit -m "feat(tiktok): 게시 진입점 스크립트 (refresh token 자동 갱신 포함)"
```

---

## Task 8: package.json scripts 추가

**Files:**
- Modify: `package.json`

- [ ] **Step 1: scripts 항목 3개 추가**

`package.json`의 `scripts` 객체에 `"telegram:failure": ...` 다음 줄에 추가:

```json
    "tiktok:setup": "tsx src/scripts/get-tiktok-token.ts",
    "tiktok:check": "tsx src/scripts/check-tiktok-token.ts",
    "post:tiktok": "tsx src/scripts/post-tiktok.ts"
```

기존 마지막 항목 끝에 콤마(,) 추가 잊지 말 것. 최종 형태:

```json
    "post:youtube": "tsx src/scripts/post-youtube-shorts.ts",
    "telegram:failure": "tsx src/scripts/telegram-failure.ts",
    "tiktok:setup": "tsx src/scripts/get-tiktok-token.ts",
    "tiktok:check": "tsx src/scripts/check-tiktok-token.ts",
    "post:tiktok": "tsx src/scripts/post-tiktok.ts"
```

- [ ] **Step 2: 검증 — 새 스크립트 인식되는지 확인**

Run: `npm run tiktok:check 2>&1 | head -5`
Expected: 환경변수 없으면 ❌ 출력하고 종료, 또는 ✅ 출력. (npm 자체가 "command not found" 안 하면 OK)

- [ ] **Step 3: 커밋**

```bash
git add package.json
git commit -m "feat(tiktok): package.json scripts (tiktok:setup/check, post:tiktok)"
```

---

## Task 9: GitHub Actions 워크플로우 통합

**Files:**
- Modify: `.github/workflows/instagram.yml`

- [ ] **Step 1: env 추가**

`.github/workflows/instagram.yml`의 `env:` 블록 (현재 `TELEGRAM_CHAT_ID` 다음, `GITHUB_REPOSITORY` 위)에 추가:

```yaml
      TIKTOK_CLIENT_KEY: ${{ secrets.TIKTOK_CLIENT_KEY }}
      TIKTOK_CLIENT_SECRET: ${{ secrets.TIKTOK_CLIENT_SECRET }}
      TIKTOK_REFRESH_TOKEN: ${{ secrets.TIKTOK_REFRESH_TOKEN }}
      TIKTOK_PRIVACY_LEVEL: ${{ vars.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY' }}
      GH_PAT_SECRETS_WRITE: ${{ secrets.GH_PAT_SECRETS_WRITE }}
```

- [ ] **Step 2: 토큰 헬스체크 단계에 tiktok:check 추가**

기존:
```yaml
      - name: 토큰 헬스체크
        run: npm run ig:check
```

다음으로 변경:
```yaml
      - name: 토큰 헬스체크
        run: npm run ig:check && npm run tiktok:check
```

(yt:check은 기존 워크플로우에 없으므로 그대로 둠 — 별도 작업이 필요하면 그때 추가)

- [ ] **Step 3: 틱톡 업로드 단계 추가**

기존 "유튜브 쇼츠 업로드" 단계 다음에 새 단계 추가:

```yaml
      - name: 틱톡 업로드
        if: always()
        run: npm run post:tiktok
```

- [ ] **Step 4: 텔레그램 성공 메시지에 틱톡 추가**

기존:
```yaml
            -d text="✅ 인스타(피드+릴스+스토리), 유튜브(쇼츠) 업로드 완료"
```

다음으로 변경:
```yaml
            -d text="✅ 인스타(피드+릴스+스토리), 유튜브(쇼츠), 틱톡 업로드 완료"
```

- [ ] **Step 5: yml 문법 확인**

Run: `node -e "require('js-yaml')" 2>&1 | head -1`

js-yaml이 없으면 다음 대안 (Python 내장):
Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/instagram.yml'))"`

둘 다 없으면 GitHub의 yml 검증은 푸시 후에만 가능. 일단 다음 단계로 진행.

- [ ] **Step 6: 커밋**

```bash
git add .github/workflows/instagram.yml
git commit -m "feat(tiktok): 워크플로우에 헬스체크/업로드 단계 추가"
```

---

## Task 10: 로컬 빌드 + 푸시

**Files:**
- N/A (검증 단계)

- [ ] **Step 1: 전체 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 빌드 성공, `/api/tiktok/callback` 라우트가 출력에 표시됨

- [ ] **Step 3: 원격 푸시**

```bash
git push origin main
```

Vercel이 자동 배포 시작. (콜백 라우트는 이미 있으므로 빌드 영향 없음 — 신규는 src/만 변경)

---

## Task 11: 사용자 — refresh token 1회 발급

**Files:**
- N/A (사용자 작업)

이 단계는 사용자가 로컬에서 직접 수행. AI 어시스턴트가 진행 가이드 제공.

- [ ] **Step 1: .env 파일에 client key/secret 임시 추가**

프로젝트 루트의 `.env` 파일에 다음 두 줄 추가:
```
TIKTOK_CLIENT_KEY=<TikTok 개발자 포털에서 복사한 client_key>
TIKTOK_CLIENT_SECRET=<TikTok 개발자 포털에서 복사한 client_secret>
```

- [ ] **Step 2: setup 스크립트 실행**

Run: `npm run tiktok:setup`
Expected: 콘솔에 authorize URL 출력 + state 값 출력 + "code 붙여넣기:" 프롬프트

- [ ] **Step 3: 브라우저에서 인증**

콘솔에 출력된 URL을 브라우저에서 열고 TikTok 로그인 → "Authorize" 클릭 → `https://haeseol.com/api/tiktok/callback?code=...&state=...` 페이지로 리다이렉트됨.

페이지에 표시된 state가 콘솔의 state와 같은지 확인. 다르면 인증 중단 (CSRF 우려).

페이지의 **code** 값을 복사.

- [ ] **Step 4: 터미널에 code 붙여넣기**

대기 중인 터미널 프롬프트에 code 붙여넣고 Enter.

Expected:
```
✅ TIKTOK_REFRESH_TOKEN =
<토큰 문자열>
```

- [ ] **Step 5: GitHub Secrets에 등록**

GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- Name: `TIKTOK_REFRESH_TOKEN`
- Value: 위에서 출력된 토큰

- [ ] **Step 6: .env에서 client_key/secret 제거**

`.env`에 임시로 추가했던 `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` 두 줄 삭제 (로컬에는 더 이상 필요 없음).

---

## Task 12: 사용자 — workflow_dispatch 1회 테스트

**Files:**
- N/A (실배포 검증)

- [ ] **Step 1: GitHub Actions에서 수동 실행**

GitHub repo → Actions 탭 → "Generate insta & youtube" 워크플로우 → "Run workflow" 버튼 → "Run workflow" 확정.

- [ ] **Step 2: 로그 모니터링**

워크플로우 실행 페이지에서 "틱톡 업로드" 단계 로그 확인:
- 🎵 TikTok 업로드 시작
- 📤 업로드 init 완료
- 📤 청크 업로드 완료
- ✅ TikTok 업로드 완료. publish_id=...
- (비공개 모드) 안내 메시지

- [ ] **Step 3: TikTok 앱에서 확인**

본인 TikTok 앱 → 프로필 → 프로필 페이지 우측 상단 "..." → 본인만 볼 수 있는 영상 / "Only you" 또는 "비공개" 섹션에 영상 표시 확인.

영상이 정상 재생되고 캡션에 `#fyp #포유` 포함되는지 확인.

- [ ] **Step 4: refresh token 회전 동작 확인**

GitHub repo → Settings → Secrets → `TIKTOK_REFRESH_TOKEN` 의 "Last updated" 시각이 워크플로우 실행 시각으로 갱신됐는지 확인.

만약 갱신 안 됐고 로그에 "🔁 refresh token 회전 없음"이 떴다면 → TikTok이 토큰을 회전 안 하는 것 (다행, 추가 작업 불필요).

만약 로그에 "⚠️ refresh token이 회전되었지만 GH_PAT_SECRETS_WRITE가 없어"가 떴다면 → 다음 작업 필요:
1. https://github.com/settings/tokens?type=beta → "Generate new token (Fine-grained)"
2. Repository access: 본 repo만 선택
3. Repository permissions: **Secrets** = Read and write
4. 발급받은 PAT를 GitHub Secrets에 `GH_PAT_SECRETS_WRITE`로 등록
5. workflow_dispatch 1회 더 실행해서 자동 갱신 동작 확인

---

## Task 13: 사용자 — 데모 영상 녹화 + 심사 신청

**Files:**
- N/A (TikTok 심사 제출)

- [ ] **Step 1: 통합 흐름 화면 녹화**

다음 흐름을 한 영상에 담아 녹화 (60초 이내, ≤ 50MB):

1. https://haeseol.com 메인 페이지 (브랜드 사이트 노출)
2. GitHub Actions의 "틱톡 업로드" 단계 로그 (또는 로컬에서 `npm run post:tiktok` 실행) — 토큰 갱신 + 영상 업로드 진행 로그
3. TikTok 앱에서 본인 계정 프로필 → 새로 올라온 비공개 영상이 표시되는 화면
4. 그 영상 재생 — 캡션 + 영상 콘텐츠 확인

녹화 도구 추천: Windows 캡처 도구 (Win+G), OBS Studio, ScreenRec.

- [ ] **Step 2: TikTok 개발자 포털에서 데모 영상 교체**

TikTok 개발자 포털 → 본 앱 → "App review" 섹션 → "Upload" → 기존 reel.mp4 삭제 → 위에서 녹화한 데모 영상 업로드.

- [ ] **Step 3: Submit for review**

상단 우측 "Submit for review" 버튼 클릭.

- [ ] **Step 4: 결과 대기**

심사 결과는 보통 1~4주 소요. 거절 시 사유 확인 후 재신청.

- [ ] **Step 5: 심사 통과 시 → 공개로 전환**

GitHub repo → Settings → Secrets and variables → Actions → **Variables** 탭 → New repository variable:
- Name: `TIKTOK_PRIVACY_LEVEL`
- Value: `PUBLIC_TO_EVERYONE`

다음 cron 실행(KST 18:18)부터 공개 게시 시작. 코드 변경 불필요.

---

## Self-Review

**1. Spec coverage:**
- ✅ 새 파일 4개 (tiktok-api.ts, post-tiktok.ts, get/check-tiktok-token.ts) — Task 1~7
- ✅ 콜백 라우트 — 사전 완료 (별도 커밋)
- ✅ package.json scripts 3개 — Task 8
- ✅ 워크플로우 통합 (env, 헬스체크, 업로드 단계, 텔레그램) — Task 9
- ✅ 시크릿 4개 (CLIENT_KEY, CLIENT_SECRET, REFRESH_TOKEN, PAT) + Variable 1개 — Task 11, 12
- ✅ FILE_UPLOAD 청크 업로드 — Task 4
- ✅ refresh token 회전 처리 — Task 7, 12
- ✅ SELF_ONLY → PUBLIC_TO_EVERYONE 전환 경로 — Task 13
- ✅ 작업 단계 1~10 — Task 매핑 완료

**2. Placeholder scan:** TODO/TBD/적절히 처리 등 없음. ✓

**3. Type consistency:**
- `getAccessToken()` → `TokenResponse { accessToken, refreshToken, expiresIn }` 일관됨
- `postVideoFileUpload(accessToken, params)` 시그니처 일관됨
- `PrivacyLevel` 유니언 일관됨 (post-tiktok.ts에서 import)
- `TIKTOK_REDIRECT_URI` 상수가 lib + script 양쪽에서 동일하게 사용됨
