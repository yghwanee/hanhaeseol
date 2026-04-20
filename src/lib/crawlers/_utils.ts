import { execSync } from "child_process";

export const CRAWLER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let fetchCallCount = 0;

/** curl 기반 동기 fetch (스크래퍼용). CRAWLER_IMPERSONATE_CMD 환경변수가 있으면 curl-impersonate 바이너리를 사용해 Cloudflare TLS fingerprint 차단을 우회한다. */
export function curlFetch(url: string, minBytes = 1000): string | null {
  const impersonate = process.env.CRAWLER_IMPERSONATE_CMD;
  const debug = process.env.CRAWLER_DEBUG === "1";
  const cmd = impersonate
    ? `${impersonate} -sL --max-time 20 "${url}"`
    : `curl -sL -A "${CRAWLER_UA}" --max-time 20 "${url}"`;

  // 첫 호출 1회만 어떤 명령을 쓰는지 로그
  if (fetchCallCount++ === 0) {
    console.log(`  [curlFetch] 사용 커맨드: ${impersonate ?? "curl(기본)"}`);
  }

  try {
    const html = execSync(cmd, { timeout: 25000, maxBuffer: 10 * 1024 * 1024 }).toString();
    if (html.length < minBytes) {
      if (debug) console.error(`  [curlFetch] 짧은 응답(${html.length}b): ${url}`);
      return null;
    }
    return html;
  } catch (e) {
    if (debug) console.error(`  [curlFetch] exec 실패: ${url} — ${(e as Error).message}`);
    return null;
  }
}

/** HTML 태그 제거 + 주요 엔티티 디코딩 + 공백 정규화 */
export function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 팀/리그명 → URL slug */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** 동시 실행 수를 제한한 병렬 실행 (Promise.all의 concurrency 제한 버전) */
export async function pLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
