import fs from "node:fs";
import sharp from "sharp";
import { getHeroMatchLines, getHierarchicalTags, getMainHighlight, getPlainTags } from "./hashtags";
import { UTM_LINKS } from "./utm";

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
      // AI 합성 이미지(ChatGPT 생성 후킹 컷)가 영상에 포함됨.
      // 2024-10-30 YouTube Data API v3에 도입된 필드. 미부착 시 정책 위반.
      containsSyntheticMedia: true,
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

  // 제목: 오늘의 hero 매치 highlight + 날짜. 매일 다른 매치업이라 박제 패턴 피함.
  // 예) 📺 5/12(월) 양민혁 EPL 한국어 중계 #Shorts
  //     📺 5/12(월) EPL 빅매치 한국어 중계 #Shorts (한국 선수 매치 없을 때)
  //     📺 5/12(월) 오늘의 한국어 중계 편성표 #Shorts (한국어해설 0경기 폴백)
  const highlight = getMainHighlight(today);
  const title = `📺 ${mNum}/${dNum}(${wd}) ${highlight} #Shorts`;

  const { lines: heroLines, totalGames } = getHeroMatchLines(today, 3);
  const hashtagLine = getHierarchicalTags(today).tags.join(" ");

  const desc: string[] = [];
  if (totalGames > 0) {
    desc.push(`${mm}/${dd} 한국어 해설 ${totalGames}경기 편성표.`);
  } else {
    desc.push(`${mm}/${dd} 한국어 해설 편성표.`);
  }
  desc.push(``);
  if (heroLines.length > 0) {
    desc.push(`🎯 오늘의 빅매치`);
    for (const line of heroLines) desc.push(line);
    if (totalGames > heroLines.length) {
      desc.push(`+ ${totalGames - heroLines.length}경기 더보기`);
    }
    desc.push(``);
  }
  desc.push(`👉 ${UTM_LINKS.yt_desc}`);
  desc.push(``);
  desc.push(hashtagLine);

  const description = desc.join("\n");
  // tags 필드는 # 없는 평문. getPlainTags가 동적 hero 태그 + brand baseline 반환.
  const tags = getPlainTags(today);
  return { title, description, tags };
}
