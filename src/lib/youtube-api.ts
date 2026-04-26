import fs from "node:fs";
import sharp from "sharp";
import { getHierarchicalTags, getMainHighlight } from "./hashtags";

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} 환경변수가 필요합니다.`);
  return v;
}

export function ytEnv() {
  return {
    clientId: env("YOUTUBE_CLIENT_ID"),
    clientSecret: env("YOUTUBE_CLIENT_SECRET"),
    refreshToken: env("YOUTUBE_REFRESH_TOKEN"),
  };
}

export async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret, refreshToken } = ytEnv();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`YouTube access_token 갱신 실패: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

export interface UploadShortsParams {
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;    // 17 = Sports
  privacyStatus?: "public" | "unlisted" | "private";
  madeForKids?: boolean;
}

export async function uploadShorts(p: UploadShortsParams): Promise<string> {
  const accessToken = await getAccessToken();

  const stat = fs.statSync(p.filePath);
  const size = stat.size;

  const metadata = {
    snippet: {
      title: p.title,
      description: p.description,
      tags: p.tags ?? [],
      categoryId: p.categoryId ?? "17",
    },
    status: {
      privacyStatus: p.privacyStatus ?? "public",
      selfDeclaredMadeForKids: p.madeForKids ?? false,
    },
  };

  // 1. resumable 업로드 세션 시작
  const initRes = await fetch(YOUTUBE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify(metadata),
  });
  if (!initRes.ok) {
    throw new Error(`업로드 세션 생성 실패: ${initRes.status} ${await initRes.text()}`);
  }
  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("업로드 URL(Location 헤더) 없음");

  // 2. 파일 바이너리 업로드
  const buf = fs.readFileSync(p.filePath);
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
    },
    body: new Uint8Array(buf),
  });
  const putData = (await putRes.json()) as { id?: string; error?: unknown };
  if (!putRes.ok || !putData.id) {
    throw new Error(`업로드 실패: ${putRes.status} ${JSON.stringify(putData)}`);
  }
  return putData.id;
}

const THUMB_MAX_BYTES = 2 * 1024 * 1024;

async function compressForThumbnail(filePath: string): Promise<Buffer> {
  // YouTube 썸네일 2MB 제한에 맞춰 JPEG 품질을 낮춰가며 인코딩
  const src = sharp(filePath);
  for (const quality of [90, 82, 74, 66, 58, 50]) {
    const out = await src.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length <= THUMB_MAX_BYTES) return out;
  }
  throw new Error("썸네일 2MB 이하로 압축 실패");
}

export async function setThumbnail(videoId: string, filePath: string): Promise<void> {
  const accessToken = await getAccessToken();
  const buf = await compressForThumbnail(filePath);

  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "image/jpeg",
        "Content-Length": String(buf.length),
      },
      body: new Uint8Array(buf),
    },
  );
  if (!res.ok) {
    throw new Error(`썸네일 업로드 실패: ${res.status} ${await res.text()}`);
  }
}

export async function addComment(videoId: string, text: string): Promise<string> {
  const accessToken = await getAccessToken();
  const body = {
    snippet: {
      videoId,
      topLevelComment: { snippet: { textOriginal: text } },
    },
  };
  const res = await fetch(`${YOUTUBE_API}/commentThreads?part=snippet`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { id?: string; error?: unknown };
  if (!res.ok || !data.id) throw new Error(`댓글 작성 실패: ${JSON.stringify(data)}`);
  return data.id;
}

export async function getChannelInfo(): Promise<{ id: string; title: string }> {
  const accessToken = await getAccessToken();
  const res = await fetch(`${YOUTUBE_API}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    items?: Array<{ id: string; snippet: { title: string } }>;
    error?: unknown;
  };
  if (!res.ok || !data.items?.[0]) {
    throw new Error(`채널 정보 조회 실패: ${JSON.stringify(data)}`);
  }
  return { id: data.items[0].id, title: data.items[0].snippet.title };
}

function getKstWeekday(): string {
  // 내일 편성 미리보기용으로 내일의 요일을 반환합니다.
  const kstStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  const d = new Date(kstStr);
  d.setDate(d.getDate() + 1);
  return ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
}

export function buildShortsMeta(mm: string, dd: string, today: string) {
  const mNum = parseInt(mm, 10);
  const dNum = parseInt(dd, 10);
  const wd = getKstWeekday();
  const highlight = getMainHighlight(today);
  // 제목: 감정/구체화형 + 메타태그(#Shorts) 박음. 설명에선 #Shorts 생략.
  const title = `📺 ${mNum}/${dNum}(${wd}) ${highlight} #Shorts`;
  const hashtagLine = getHierarchicalTags(today).tags.join(" ");
  const description = [
    `${mm}/${dd} 한국어 해설이 있는 모든 경기를 한곳에.`,
    ``,
    `⚽️ 축구  ⚾️ 야구  🏀 농구  🏐 배구`,
    ``,
    `👉 https://haeseol.com/`,
    ``,
    hashtagLine,
  ].join("\n");
  const tags = [
    "한해설", "한국어해설", "한국어중계", "스포츠중계", "편성표",
    "축구중계", "야구중계", "농구중계", "배구중계",
    "스포티비", "쿠팡플레이", "티빙", "EPL", "KBO", "MLB",
  ];
  return { title, description, tags };
}
