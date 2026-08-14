import { getHeroMatchLines, getHierarchicalTags, getMainHighlight, getHeroEventWord } from "./hashtags";
import { inferDayLabel, pickHeroForDate } from "./instagram";
import { buildHookLine } from "./shorts-title";

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

/** 캐러셀(피드) / 릴스 — 같은 실행에서 나란히 올라가는 두 게시물. */
export type CaptionSurface = "feed" | "reel";

/**
 * 후킹 문장의 주인공(pickHeroForDate — 연속 방지 감점 적용)에 해당하는 줄을 목록에서 찾는다.
 * 못 찾으면 첫 줄로 떨어진다.
 */
function pickHeroOwnLine(today: string, lines: string[]): string[] {
  if (lines.length === 0) return [];
  const hero = pickHeroForDate(today);
  if (hero) {
    const own = lines.find(
      (l) => l.includes(hero.homeTeam) && (!hero.awayTeam || l.includes(hero.awayTeam)),
    );
    if (own) return [own];
  }
  return [lines[0]];
}

/**
 * 해시태그 묶음은 같아도 순서를 게시면별로 돌린다.
 * 인스타 중복 판정은 캡션 문자열 기준이라, 본문을 갈라 놓고 태그 줄만 글자까지 같으면
 * 그 줄이 다시 동일 신호가 된다. 태그 자체를 빼면 도달을 잃으므로 순서만 바꾼다.
 */
function rotateTags(tags: string[], surface: CaptionSurface): string {
  if (tags.length < 2 || surface === "feed") return tags.join(" ");
  // 🔴 고정 상수로 나누면 몫이 0 이 되는 길이가 생긴다(태그 3개에 shift 3 → 회전 없음,
  // 실제로 가드에 걸렸다). 길이에 비례시켜 1 이상을 보장한다.
  const k = Math.max(1, Math.floor(tags.length / 2));
  return [...tags.slice(k), ...tags.slice(0, k)].join(" ");
}

/**
 * 인스타 캡션.
 *
 * 🔴 게시면별로 **본문 구조가 다르다**. 2026-08-07 실측에서 캐러셀과 릴스가 링크의 UTM
 * 파라미터만 빼고 글자까지 같은 캡션으로 매일 두 번씩 올라가고 있었다. 유튜브 피드
 * 배포를 끊었던 중복 신호와 같은 구조라, 첫 줄만이 아니라 담는 내용 자체를 갈랐다.
 *   · 캐러셀 = 편성표 전체가 매체다 → 주요 경기 3줄 + 총 경기 수
 *   · 릴스   = 히어로 한 경기가 매체다 → 그 경기 1줄에 집중
 */
export function buildCaption(
  mm: string,
  dd: string,
  today: string,
  link: string,
  surface: CaptionSurface = "feed",
) {
  const dayLabel = inferDayLabel(today);
  const tags = getHierarchicalTags(today).tags;
  const highlight = getMainHighlight(today);
  // 릴스는 히어로 한 경기만 싣지만 후보를 넉넉히 받아 그중 히어로 경기를 골라낸다
  // (아래 주석 참조 — 목록 순서와 후킹 주인공이 갈릴 수 있다).
  const { lines: allLines, totalGames } = getHeroMatchLines(today, surface === "feed" ? 3 : 6);
  const heroLines = surface === "feed" ? allLines : pickHeroOwnLine(today, allLines);

  const body: string[] = [];
  // 첫 줄 = 슬롯 × 게시면별 후킹. 저녁(내일 경기)/다음날 아침(오늘 경기)은 대상 날짜가
  // 같고, 캐러셀·릴스는 대상 날짜와 슬롯이 둘 다 같다. 두 축을 모두 갈라야 안 겹친다.
  body.push(buildHookLine(today, undefined, surface === "feed" ? "ig-feed" : "ig-reel"));
  body.push(``);

  if (heroLines.length === 0) {
    body.push(`${dayLabel}은 한국어 해설 편성이 없어요.`);
  } else if (surface === "feed") {
    body.push(`📺 ${mm}/${dd} ${highlight}`);
    body.push(``);
    body.push(`🎯 ${dayLabel}의 ${getHeroEventWord(today)}`);
    for (const line of heroLines) body.push(line);
    body.push(``);
    body.push(
      totalGames > heroLines.length
        ? `+ ${totalGames - heroLines.length}경기 더보기`
        : `총 ${totalGames}경기`,
    );
  } else {
    // 🔴 첫 줄을 그냥 쓰면 안 된다. 후킹 문장의 주인공은 pickHeroForDate(연속 방지 감점 적용)
    // 가 고르고, 이 목록은 pickHeroMatchesTop(감점 없음) 순서라 둘이 갈릴 수 있다.
    // 실측(2026-08-08): 후킹은 "이정후"인데 목록 첫 줄은 다저스 경기였다 —
    // 캐러셀은 3줄이라 그 안에 섞여 안 보였지만, 릴스는 한 줄이라 캡션이 자기모순이 된다.
    body.push(`🎯 ${dayLabel} 주목 경기`);
    body.push(heroLines[0]);
    body.push(``);
    body.push(`${dayLabel} 한국어 해설 총 ${totalGames}경기`);
  }

  body.push(``);
  body.push(link);
  body.push(``);
  body.push(rotateTags(tags, surface));

  return body.join("\n");
}

// raw.githubusercontent(Fastly)는 404를 300초간 네거티브 캐시한다. 푸시 직후
// 전파 레이스로 한번 404가 캐시되면, 재시도 예산(~105초)으로는 그 캐시를 못 넘겨
// 같은 9004/2207052를 계속 맞고 실패한다. 재시도마다 cb 쿼리를 바꿔 캐시 키를
// 새로 만들면 캐시된 404를 즉시 우회한다. 캐러셀 미디어 URL에만 적용.
function withCacheBust(params: Record<string, string>, attempt: number, salt = ""): Record<string, string> {
  const runId = process.env.GITHUB_RUN_ID ?? "local";
  const cb = `${runId}-${salt}${attempt}`;
  const out = { ...params };
  for (const key of ["image_url", "video_url", "cover_url"] as const) {
    const url = out[key];
    if (!url || !/^https?:\/\//.test(url)) continue;
    out[key] = url + (url.includes("?") ? "&" : "?") + `cb=${cb}`;
  }
  return out;
}

// 🔴 export 하지 않는다. 이걸 직접 부르면 컨테이너 트랜스코딩 실패(2207052 등) 재시도가
// 빠진 경로가 만들어진다 — 2026-08-02 릴스 미게시가 정확히 그 구조였다.
// 밖에서는 항상 createFinishedContainer / publishSingleMedia 를 쓴다.
async function postMedia(
  params: Record<string, string>,
  maxRetries = 8,
  retryDelayMs = 15000,
  cbSalt = "",
): Promise<string> {
  const { igId, token } = igEnv();
  for (let attempt = 1; ; attempt++) {
    const body = new URLSearchParams({ ...withCacheBust(params, attempt, cbSalt), access_token: token });
    const res = await fetch(`${IG_API}/${igId}/media`, { method: "POST", body });
    const data = await res.json();
    if (res.ok && data.id) return data.id as string;
    // 일시 오류 2종: ①raw CDN 전파 지연으로 Meta가 미디어 URI를 못 가져옴(9004/2207052)
    // ②Meta 쪽 장애(code=2, is_transient). ②는 수 분 지속될 수 있어 고정 15s×5(~75s)로는
    // 못 버팀(2026-07-19 저녁 게시 3종 전멸) → 지수 백오프로 최대 ~10분 커버.
    if (isRetryableMediaCreate(data.error) && attempt < maxRetries) {
      const delayMs = Math.min(retryDelayMs * 2 ** (attempt - 1), 120000);
      console.warn(
        `⚠️  미디어 생성 ${attempt}/${maxRetries} — 일시 오류(CDN 전파/Meta 장애/이미지 변환), ${delayMs / 1000}s 후 재시도: ${JSON.stringify(data.error)}`,
      );
      await sleep(delayMs);
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

/**
 * Meta 쪽 이미지 변환기(Telephoto)가 죽은 케이스. 2026-08-15 아침 캐러셀이 여기서 전멸했다:
 * `36001 / 2207084 — image/png ... JPEG 로 변환하지 못했습니다 (PNG chunk is missing
 * required data)`. 그때 올린 PNG 8장은 CRC 까지 전수 검사해 전부 멀쩡했다.
 *
 * `is_transient: false` 로 오지만 **우리 파일 문제가 아니므로** 재시도 대상으로 둔다.
 * 근본 대책은 애초에 변환을 안 시키는 것(JPEG 업로드) — `src/lib/ig-image.ts` 참조.
 */
const IMAGE_CONVERT_FAILED_SUBCODE = 2207084;

/** `/media` 컨테이너 생성 실패 중 다시 걸어 볼 만한 것. postMedia 전용. */
export function isRetryableMediaCreate(err: IgError | undefined): boolean {
  if (!err) return false;
  if (err.error_subcode === IMAGE_CONVERT_FAILED_SUBCODE) return true;
  return isTransientFetch(err);
}

// Meta가 Page Access Token으로 미디어 컨테이너 노드 직접 GET 호출을 막은 케이스.
// 5/23부터 모든 컨테이너 GET이 code=100/subcode=33으로 거부됨.
function isNodeGetForbidden(err: IgError | undefined): boolean {
  return !!err && err.code === 100 && err.error_subcode === 33;
}

/**
 * 컨테이너가 `status_code=ERROR/EXPIRED` 로 끝난 경우. API 호출 자체는 200 이라
 * `data.error` 가 없고 에러 코드가 `status` **문자열** 안에 들어온다
 * (예: `Error: Media upload has failed with error code 2207052`).
 * 그래서 isTransientFetch(=error 객체 검사)로는 절대 안 잡힌다.
 */
export class ContainerFailedError extends Error {
  constructor(
    readonly containerId: string,
    readonly statusCode: string,
    readonly statusText: string,
    readonly retryable: boolean,
  ) {
    super(`컨테이너 ${containerId} 처리 실패: ${statusCode} (${statusText})`);
    this.name = "ContainerFailedError";
  }
}

// Meta 가 업로드/트랜스코딩 중에 내는 코드 중 **일시적인 것**.
// 같은 파일·같은 URL 로 컨테이너를 새로 만들면 통과하는 부류다.
const RETRYABLE_CONTAINER_CODES = [
  2207001, // Video download error
  2207003, // Media fetch error
  2207008, // Media fetch timeout
  2207020, // Unknown error (transcode)
  2207032, // Create media failed
  2207052, // Unknown upload error  ← 2026-08-02 저녁 릴스 실패
  2207053, // Unknown error
  9004, // 미디어 URI fetch 불가
];

// 파일 자체가 규격 위반인 것들. 재시도해도 100% 같은 결과라 즉시 실패해야 한다.
const PERMANENT_CONTAINER_CODES = [
  2207004, // 파일 용량 초과
  2207005, // 지원하지 않는 포맷
  2207006, // 재생 시간 위반
  2207009, // 화면비 위반
  2207010, // 해상도 위반
  2207026, // 지원하지 않는 비디오 포맷
];

/** 컨테이너 status 문자열에서 Meta 에러 코드를 뽑는다. 없으면 null. */
export function parseContainerErrorCode(statusText: string): number | null {
  const m = /error code (\d+)/i.exec(statusText);
  return m ? Number(m[1]) : null;
}

/** 컨테이너 실패가 재시도로 풀릴 수 있는 종류인지. 코드를 못 읽으면 재시도 쪽으로 둔다. */
export function isRetryableContainerFailure(statusCode: string, statusText: string): boolean {
  // EXPIRED = 24시간 내 게시 안 됨. 새 컨테이너를 만들면 된다.
  if (statusCode === "EXPIRED") return true;
  const code = parseContainerErrorCode(statusText);
  if (code === null) return true; // 원인 불명 → 한 번은 더 해본다
  if (PERMANENT_CONTAINER_CODES.includes(code)) return false;
  return RETRYABLE_CONTAINER_CODES.includes(code);
}

// publish 호출 시 컨테이너가 아직 IN_PROGRESS면 받는 종류의 에러
function isMediaNotReady(err: IgError | undefined): boolean {
  if (!err) return false;
  if (err.code === 9007 || err.error_subcode === 2207027) return true;
  const msg = err.message ?? "";
  return /not available|still being processed|is being processed|media is not ready/i.test(msg);
}

// postMedia 와 같은 이유로 비공개 — 재시도 없는 경로를 밖에 열어두지 않는다.
async function waitForFinished(containerId: string, maxAttempts = 20, intervalMs = 3000) {
  const { token } = igEnv();
  let lastData: Record<string, unknown> | null = null;
  let lastStatusCode: string | undefined;
  let transientErrors = 0;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${IG_API}/${containerId}?fields=status_code,status&access_token=${token}`);
    const data = (await res.json()) as Record<string, unknown>;
    lastData = data;
    const err = data.error as IgError | undefined;

    // Meta 일시 장애(code=2/is_transient): 컨테이너 상태가 아니라 조회 호출 자체가 실패한 것.
    // 폴링 예산(i)을 소모하지 않고 별도 카운터로 최대 30회×10s(+5분) 더 기다린다.
    // (2026-07-19 캐러셀: 컨테이너는 멀쩡한데 상태 조회가 code=2만 돌려줘 60s 예산 소진 → 실패)
    if (isTransientFetch(err)) {
      if (++transientErrors > 30) {
        throw new Error(`컨테이너 ${containerId} 상태 조회 일시 장애 지속(30회 초과): ${JSON.stringify(err)}`);
      }
      console.warn(`   [poll] ${containerId} Meta 일시 오류(${transientErrors}/30), 10s 후 재조회: ${JSON.stringify(err)}`);
      i--;
      await sleep(10000);
      continue;
    }

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
      const statusText = typeof data.status === "string" ? data.status : JSON.stringify(data);
      throw new ContainerFailedError(
        containerId,
        statusCode,
        statusText,
        isRetryableContainerFailure(statusCode, statusText),
      );
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
    // Meta 일시 장애(is_transient)도 같은 경로로 재시도.
    const pubErr = data.error as IgError | undefined;
    if ((isMediaNotReady(pubErr) || isTransientFetch(pubErr)) && attempt < maxRetries) {
      console.warn(`⚠️  publish ${attempt}/${maxRetries} — 미디어 미준비/일시 오류, ${retryDelayMs / 1000}s 후 재시도: ${JSON.stringify(data.error)}`);
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

/**
 * 컨테이너를 만들고 FINISHED 까지 기다린다. 트랜스코딩이 일시 오류로 죽으면
 * **컨테이너를 새로 만들어** 다시 시도한다.
 *
 * 2026-08-02 저녁 릴스가 이걸로 실패했다 — 컨테이너 생성(postMedia)은 성공하고
 * 그 다음 트랜스코딩에서 `status_code=ERROR / error code 2207052`(일시 오류)가
 * 났는데, 재시도가 postMedia 안에만 있어서 한 번 만에 포기했다.
 * ERROR 는 컨테이너의 최종 상태라 같은 컨테이너를 다시 폴링해봐야 소용없고,
 * 반드시 새 컨테이너를 만들어야 한다.
 */
export async function createFinishedContainer(
  params: Record<string, string>,
  waitMaxAttempts = 20,
  maxContainerAttempts = 3,
  retryDelayMs = 20000,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    // 시도마다 캐시버스터 salt 를 바꿔, 혹시 CDN 에 물린 깨진 응답을 물려받지 않게 한다.
    const containerId = await postMedia(params, 8, 15000, `c${attempt}-`);
    try {
      await waitForFinished(containerId, waitMaxAttempts);
      return containerId;
    } catch (e) {
      const failed = e instanceof ContainerFailedError;
      if (!failed || !e.retryable || attempt >= maxContainerAttempts) throw e;
      const delayMs = retryDelayMs * attempt;
      console.warn(
        `⚠️  컨테이너 처리 실패 ${attempt}/${maxContainerAttempts} — 일시 오류, ${delayMs / 1000}s 후 새 컨테이너로 재시도: ${e.message}`,
      );
      await sleep(delayMs);
    }
  }
}

/** 단일 미디어(릴스/스토리) 컨테이너 생성 → 대기 → 게시 */
export async function publishSingleMedia(
  params: Record<string, string>,
  waitMaxAttempts = 20,
): Promise<string> {
  const containerId = await createFinishedContainer(params, waitMaxAttempts);
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
