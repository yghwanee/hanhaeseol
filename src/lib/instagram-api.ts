import { getHeroMatchLines, getHierarchicalTags, getMainHighlight, getHeroEventWord } from "./hashtags";
import { inferDayLabel } from "./instagram";

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

export function buildCaption(mm: string, dd: string, today: string, link: string) {
  const dayLabel = inferDayLabel(today);
  const hashtagLine = getHierarchicalTags(today).tags.join(" ");
  const highlight = getMainHighlight(today);
  const { lines: heroLines, totalGames } = getHeroMatchLines(today, 3);

  const body: string[] = [];
  body.push(`📺 ${mm}/${dd} ${highlight}`);
  body.push(``);

  if (heroLines.length > 0) {
    body.push(`🎯 ${dayLabel}의 ${getHeroEventWord(today)}`);
    for (const line of heroLines) body.push(line);
    body.push(``);
    if (totalGames > heroLines.length) {
      body.push(`+ ${totalGames - heroLines.length}경기 더보기`);
    } else {
      body.push(`총 ${totalGames}경기`);
    }
  } else {
    body.push(`${dayLabel}은 한국어 해설 편성이 없어요.`);
  }
  body.push(``);
  body.push(link);
  body.push(``);
  body.push(hashtagLine);

  return body.join("\n");
}

export async function postMedia(
  params: Record<string, string>,
  maxRetries = 5,
  retryDelayMs = 15000,
): Promise<string> {
  const { igId, token } = igEnv();
  for (let attempt = 1; ; attempt++) {
    const body = new URLSearchParams({ ...params, access_token: token });
    const res = await fetch(`${IG_API}/${igId}/media`, { method: "POST", body });
    const data = await res.json();
    if (res.ok && data.id) return data.id as string;
    // raw.githubusercontent CDN가 방금 푸시한 커밋을 아직 전파 못해 Meta가
    // 미디어 URI를 못 가져온 케이스(9004/2207052). 잠깐 뒤 재시도하면 회복됨.
    if (isTransientFetch(data.error) && attempt < maxRetries) {
      console.warn(
        `⚠️  미디어 생성 ${attempt}/${maxRetries} — URI fetch 실패(CDN 전파 대기), ${retryDelayMs / 1000}s 후 재시도: ${JSON.stringify(data.error)}`,
      );
      await sleep(retryDelayMs);
      continue;
    }
    throw new Error(`미디어 생성 실패: ${JSON.stringify(data)}`);
  }
}

type IgError = { code?: number; error_subcode?: number; message?: string; is_transient?: boolean };

// 미디어 URI를 Meta가 일시적으로 못 가져온 케이스. raw CDN 전파 지연이 주원인.
function isTransientFetch(err: IgError | undefined): boolean {
  if (!err) return false;
  if (err.code === 9004 || err.error_subcode === 2207052) return true;
  if (err.is_transient) return true;
  const msg = err.message ?? "";
  return /can(no| )?t be fetched|could not be fetched|fetch the media/i.test(msg);
}

// Meta가 Page Access Token으로 미디어 컨테이너 노드 직접 GET 호출을 막은 케이스.
// 5/23부터 모든 컨테이너 GET이 code=100/subcode=33으로 거부됨.
function isNodeGetForbidden(err: IgError | undefined): boolean {
  return !!err && err.code === 100 && err.error_subcode === 33;
}

// publish 호출 시 컨테이너가 아직 IN_PROGRESS면 받는 종류의 에러
function isMediaNotReady(err: IgError | undefined): boolean {
  if (!err) return false;
  if (err.code === 9007 || err.error_subcode === 2207027) return true;
  const msg = err.message ?? "";
  return /not available|still being processed|is being processed|media is not ready/i.test(msg);
}

export async function waitForFinished(containerId: string, maxAttempts = 20, intervalMs = 3000) {
  const { token } = igEnv();
  let lastData: Record<string, unknown> | null = null;
  let lastStatusCode: string | undefined;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${IG_API}/${containerId}?fields=status_code,status&access_token=${token}`);
    const data = (await res.json()) as Record<string, unknown>;
    lastData = data;
    const err = data.error as IgError | undefined;

    // 노드 GET이 막혔으면 폴링이 영영 안 됨 → 남은 시간만큼 시간 기반 sleep 후 publish에 맡긴다.
    if (isNodeGetForbidden(err)) {
      const remainingMs = intervalMs * (maxAttempts - i);
      console.warn(`   [poll ${i + 1}/${maxAttempts}] ${containerId} 노드 GET 거부 (code=100/sub=33) → ${Math.round(remainingMs / 1000)}s 시간 기반 대기로 전환`);
      await sleep(remainingMs);
      return;
    }

    const statusCode = typeof data.status_code === "string" ? data.status_code : undefined;
    if (statusCode !== lastStatusCode) {
      console.log(`   [poll ${i + 1}/${maxAttempts}] ${containerId} status_code=${statusCode ?? "?"} status=${data.status ?? ""}`);
      lastStatusCode = statusCode;
    }
    if (statusCode === "FINISHED") return;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(`컨테이너 ${containerId} 처리 실패: ${statusCode} raw=${JSON.stringify(data)}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`컨테이너 ${containerId} 처리 시간 초과 (마지막 status_code=${lastStatusCode ?? "?"}, raw=${JSON.stringify(lastData)})`);
}

export async function publish(creationId: string, maxRetries = 6, retryDelayMs = 15000): Promise<string> {
  const { igId, token } = igEnv();
  const startedAt = Date.now();
  let lastData: Record<string, unknown> = {};
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const body = new URLSearchParams({ creation_id: creationId, access_token: token });
    const res = await fetch(`${IG_API}/${igId}/media_publish`, { method: "POST", body });
    const data = (await res.json()) as Record<string, unknown>;
    lastData = data;
    if (res.ok && data.id) return data.id as string;

    // 컨테이너가 아직 처리 중이면 잠시 후 재시도. waitForFinished가 노드 GET 거부로
    // 시간 기반 폴백을 거친 경우, publish 첫 시도 시점에 IN_PROGRESS일 수 있음.
    if (isMediaNotReady(data.error as IgError | undefined) && attempt < maxRetries) {
      console.warn(`⚠️  publish ${attempt}/${maxRetries} — 미디어 미준비, ${retryDelayMs / 1000}s 후 재시도: ${JSON.stringify(data.error)}`);
      await sleep(retryDelayMs);
      continue;
    }
    break;
  }

  // IG가 "Application request limit reached"(code 4, subcode 2207051) 같은 에러를 내도
  // 실제로는 게시가 처리된 경우가 있음. 최근 피드를 조회해 방금 올라간 media를 복구한다.
  console.warn(`⚠️  publish 응답 에러, 최근 media 조회로 폴백: ${JSON.stringify(lastData)}`);
  const recovered = await findRecentlyPublishedMediaId(startedAt);
  if (recovered) {
    console.log(`✅ 폴백으로 복구된 Media ID: ${recovered}`);
    return recovered;
  }
  throw new Error(`게시 실패 (폴백도 실패): ${JSON.stringify(lastData)}`);
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
