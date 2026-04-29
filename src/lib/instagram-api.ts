import { getHierarchicalTags } from "./hashtags";

const IG_API = "https://graph.facebook.com/v21.0";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} 환경변수가 필요합니다.`);
  return v;
}

export function igEnv() {
  return { igId: env("IG_BUSINESS_ACCOUNT_ID"), token: env("IG_PAGE_ACCESS_TOKEN") };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function buildCaption(mm: string, dd: string, today: string) {
  const hashtagLine = getHierarchicalTags(today).tags.join(" ");
  return [
    `📺 ${mm}/${dd} 오늘의 한국어 중계 편성표`,
    ``,
    `⚽️ 축구  ⚾️ 야구  🏀 농구  🏐 배구`,
    `한국어 해설이 있는 모든 경기를 한곳에.`,
    ``,
    `https://haeseol.com/`,
    ``,
    hashtagLine,
  ].join("\n");
}

export async function postMedia(params: Record<string, string>): Promise<string> {
  const { igId, token } = igEnv();
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${IG_API}/${igId}/media`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(`미디어 생성 실패: ${JSON.stringify(data)}`);
  return data.id as string;
}

export async function waitForFinished(containerId: string, maxAttempts = 20, intervalMs = 3000) {
  const { token } = igEnv();
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${IG_API}/${containerId}?fields=status_code&access_token=${token}`);
    const data = await res.json();
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`컨테이너 ${containerId} 처리 실패: ${data.status_code}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`컨테이너 ${containerId} 처리 시간 초과`);
}

export async function publish(creationId: string): Promise<string> {
  const { igId, token } = igEnv();
  const startedAt = Date.now();
  const body = new URLSearchParams({ creation_id: creationId, access_token: token });
  const res = await fetch(`${IG_API}/${igId}/media_publish`, { method: "POST", body });
  const data = await res.json();
  if (res.ok && data.id) return data.id as string;

  // IG가 "Application request limit reached"(code 4, subcode 2207051) 같은 에러를 내도
  // 실제로는 게시가 처리된 경우가 있음. 최근 피드를 조회해 방금 올라간 media를 복구한다.
  console.warn(`⚠️  publish 응답 에러, 최근 media 조회로 폴백: ${JSON.stringify(data)}`);
  const recovered = await findRecentlyPublishedMediaId(startedAt);
  if (recovered) {
    console.log(`✅ 폴백으로 복구된 Media ID: ${recovered}`);
    return recovered;
  }
  throw new Error(`게시 실패 (폴백도 실패): ${JSON.stringify(data)}`);
}

async function findRecentlyPublishedMediaId(
  startedAt: number,
  maxAttempts = 6,
  intervalMs = 3000,
): Promise<string | null> {
  const { igId, token } = igEnv();
  // 요청 시작 5분 전까지를 복구 대상으로 간주 (스케줄 1회/일 이라 충돌 없음)
  const threshold = startedAt - 5 * 60 * 1000;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(intervalMs);
    const url = `${IG_API}/${igId}/media?fields=id,timestamp&limit=5&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    const items: Array<{ id: string; timestamp: string }> = data?.data ?? [];
    const match = items.find((m) => new Date(m.timestamp).getTime() >= threshold);
    if (match) return match.id;
  }
  return null;
}

export function mediaBaseUrl() {
  const repo = process.env.GITHUB_REPOSITORY || "yghwanee/hanhaeseol";
  return `https://raw.githubusercontent.com/${repo}/insta-media`;
}

/** 단일 미디어(릴스/스토리) 컨테이너 생성 → 대기 → 게시 */
export async function publishSingleMedia(
  params: Record<string, string>,
  waitMaxAttempts = 20,
): Promise<string> {
  const containerId = await postMedia(params);
  await waitForFinished(containerId, waitMaxAttempts);
  return publish(containerId);
}

export async function comment(mediaId: string, message: string): Promise<string> {
  const { token } = igEnv();
  const body = new URLSearchParams({ message, access_token: token });
  const res = await fetch(`${IG_API}/${mediaId}/comments`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(`댓글 작성 실패: ${JSON.stringify(data)}`);
  return data.id as string;
}
