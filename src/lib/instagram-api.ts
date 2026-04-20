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

export function buildCaption(mm: string, dd: string) {
  return [
    `📺 ${mm}/${dd} 오늘의 한국어 중계 편성표`,
    ``,
    `⚽️ 축구  ⚾️ 야구  🏀 농구  🏐 배구`,
    `한국어 해설이 있는 모든 경기를 한곳에.`,
    ``,
    `https://haeseol.com/`,
    ``,
    `#한해설 #한국어해설 #한국어중계 #스포츠 #스포츠중계 #편성표 #중계편성표 #축구중계 #야구중계 #농구중계 #배구중계 #스포티비 #쿠팡플레이 #티빙 #MBC #SBS #KBS #애플티비 #tvN #EPL #프리미어리그 #KBO #국야 #MLB #믈브 #분데스리가 #라리가 #월드컵 #프로야구`,
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
  const body = new URLSearchParams({ creation_id: creationId, access_token: token });
  const res = await fetch(`${IG_API}/${igId}/media_publish`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(`게시 실패: ${JSON.stringify(data)}`);
  return data.id as string;
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
