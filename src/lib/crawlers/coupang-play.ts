import { Schedule, Sport } from "@/types/schedule";

interface CoupangEvent {
  event_id: string;
  start_at: string;
  title: string;
  type: string;
  league: {
    name: string;
    shortName: string;
    sportTypeName: string;
  };
  teams: { name: string }[];
}

const SPORT_MAP: Record<string, Sport> = {
  "농구": "농구",
  "축구": "축구",
  "해외축구": "축구",
  "야구": "야구",
  "배구": "배구",
};

interface CoupangTokens {
  pAt: string;
  ctAt: string | null;
}

async function refreshTokens(): Promise<CoupangTokens | null> {
  const ctLsid = process.env.COUPANG_CT_LSID;
  const deviceId = process.env.COUPANG_DEVICE_ID;
  const memberSrl = process.env.COUPANG_MEMBER_SRL;
  const token = process.env.COUPANG_TOKEN;

  if (!ctLsid || !deviceId || !memberSrl || !token) return null;

  const cookies = `CT_LSID=${ctLsid}; device_id=${deviceId}; member_srl=${memberSrl}; token=${token}; NEXT_LOCALE=ko`;
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  // Step 1: /oauth2/login → 307 /home
  const r1 = await fetch("https://www.coupangplay.com/oauth2/login?rtnUrl=https%3A%2F%2Fwww.coupangplay.com%2Fhome", {
    headers: { Cookie: cookies, "User-Agent": ua },
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });

  // Step 2: /home → P_AT, CT_AT in Set-Cookie
  const r2 = await fetch("https://www.coupangplay.com/home", {
    headers: { Cookie: cookies, "User-Agent": ua },
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });

  // 모든 Set-Cookie에서 P_AT, CT_AT 추출
  let pAt: string | null = null;
  let ctAt: string | null = null;

  const extractFromCookies = (headers: Headers) => {
    const setCookies = headers.getSetCookie?.() ?? [];
    for (const v of setCookies) {
      if (v.startsWith("P_AT=")) pAt = v.split(";")[0].replace("P_AT=", "");
      if (v.startsWith("CT_AT=")) ctAt = v.split(";")[0].replace("CT_AT=", "");
    }
    for (const [k, v] of headers.entries()) {
      if (k === "set-cookie") {
        if (!pAt && v.includes("P_AT=")) {
          const match = v.match(/P_AT=([^;,]+)/);
          if (match) pAt = match[1];
        }
        if (!ctAt && v.includes("CT_AT=")) {
          const match = v.match(/CT_AT=([^;,]+)/);
          if (match) ctAt = match[1];
        }
      }
    }
  };

  extractFromCookies(r1.headers);
  extractFromCookies(r2.headers);

  if (pAt) {
    console.log(`  쿠팡플레이: 토큰 갱신 성공 (P_AT=${pAt.slice(0, 20)}..., CT_AT=${ctAt ? ctAt.slice(0, 20) + "..." : "없음"})`);
    return { pAt, ctAt };
  }

  return null;
}

async function fetchCommentaryInfo(
  eventId: string,
  cookies: string,
  headers: Record<string, string>,
): Promise<boolean | null> {
  try {
    const res = await fetch(
      `https://www.coupangplay.com/api/v1.1/personalize/events?id=${eventId}`,
      {
        headers: { ...headers, Cookie: cookies },
        signal: AbortSignal.timeout(10000),
      }
    );
    const text = await res.text();
    if (!text.startsWith("{")) return null;
    const detail = JSON.parse(text);
    const desc: string = detail?.data?.description || "";
    const isLocal = desc.includes("현지 해설") || desc.includes("현지해설");
    console.log(`  [해설] description="${desc}" → ${isLocal ? "현지해설" : "한국어해설"}`);
    return !isLocal;
  } catch {
    return null;
  }
}

export async function crawlCoupangPlay(date: string): Promise<Schedule[]> {
  const deviceId = process.env.COUPANG_DEVICE_ID;
  const memberSrl = process.env.COUPANG_MEMBER_SRL;
  const profileId = process.env.COUPANG_PROFILE_ID;

  if (!deviceId || !memberSrl || !profileId) {
    console.error("쿠팡플레이: 환경변수 미설정");
    return [];
  }

  // 항상 토큰 갱신 시도하여 P_AT + CT_AT 모두 확보
  const tokens = await refreshTokens();
  const pAt = tokens?.pAt || process.env.COUPANG_P_AT || null;
  const ctAt = tokens?.ctAt || null;

  if (!pAt) {
    console.error("쿠팡플레이: 토큰 갱신 실패");
    return [];
  }

  // 스케줄 API용 쿠키
  const scheduleCookies = `NEXT_LOCALE=ko; P_AT=${pAt}; device_id=${deviceId}; member_srl=${memberSrl}; PCID=17755361609406080915557`;
  const commonHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    accept: "application/json",
    "content-type": "application/json",
    "x-app-version": "1.72.6",
    "x-device-id": deviceId,
    "x-device-os-version": "146",
    "x-membersrl": memberSrl,
    "x-pcid": "17755361609406080915557",
    "x-platform": "WEBCLIENT",
    "x-profileid": profileId,
    "x-profiletype": "standard",
    Referer: "https://www.coupangplay.com/schedule",
  };

  const url = `https://www.coupangplay.com/api-discover/v1/sports/curated-schedule/events?base_date=${date}&unit=day&locale=ko&region=KR&scope=all&includeHighlights=false&includeSportsChannelContents=true`;

  const res = await fetch(url, {
    headers: { ...commonHeaders, Cookie: scheduleCookies },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`쿠팡플레이: HTTP ${res.status}`);
    return [];
  }

  let data: { data?: CoupangEvent[] };
  try {
    data = await res.json();
  } catch {
    console.error("쿠팡플레이: JSON 파싱 실패");
    return [];
  }

  const events = data.data || [];
  const schedules: Schedule[] = [];

  // 상세 API용 쿠키 (CT_AT 포함)
  const ctLsid = process.env.COUPANG_CT_LSID || "";
  const token = process.env.COUPANG_TOKEN || "";
  const detailCookies = `NEXT_LOCALE=ko; P_AT=${pAt}; CT_AT=${ctAt || ""}; CT_LSID=${ctLsid}; token=${token}; device_id=${deviceId}; member_srl=${memberSrl}; PCID=17755361609406080915557; core_token_exist=true`;

  // 해당 날짜의 유효 이벤트만 필터
  const validEvents: { event: CoupangEvent; time: string }[] = [];
  for (const event of events) {
    if (event.type !== "LIVE") continue;
    if (event.teams.length < 2) continue;

    const sport = SPORT_MAP[event.league.sportTypeName];
    if (!sport) continue;

    const kst = new Date(event.start_at);
    const yyyy = kst.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric" }).replace(/[^0-9]/g, "");
    const mm = String(kst.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric" }).replace(/[^0-9]/g, "")).padStart(2, "0");
    const dd = String(kst.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", day: "numeric" }).replace(/[^0-9]/g, "")).padStart(2, "0");
    const itemDate = `${yyyy}-${mm}-${dd}`;

    if (itemDate !== date) continue;

    const hh = String(kst.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", hour12: false }).replace(/[^0-9]/g, "")).padStart(2, "0");
    const min = String(kst.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", minute: "numeric" }).replace(/[^0-9]/g, "")).padStart(2, "0");
    validEvents.push({ event, time: `${hh}:${min}` });
  }

  // 각 이벤트의 해설 정보를 병렬로 조회 (CT_AT 있을 때만)
  let commentaryResults: (boolean | null)[];
  if (ctAt) {
    commentaryResults = await Promise.all(
      validEvents.map(({ event }) =>
        fetchCommentaryInfo(event.event_id, detailCookies, commonHeaders)
      )
    );
  } else {
    console.log("  쿠팡플레이: CT_AT 없음 → 해설 판별 스킵 (전부 확인중)");
    commentaryResults = validEvents.map(() => null);
  }

  for (let i = 0; i < validEvents.length; i++) {
    const { event, time } = validEvents[i];
    const sport = SPORT_MAP[event.league.sportTypeName];
    if (!sport) continue;

    schedules.push({
      id: `coupang-${date}-${time}-${event.league.shortName}-${event.teams[0].name}-${event.teams[1].name}`,
      date,
      time,
      sport,
      league: event.league.name,
      homeTeam: event.teams[0].name,
      awayTeam: event.teams[1].name,
      platform: "쿠팡플레이",
      koreanCommentary: commentaryResults[i],
    });
  }

  return schedules;
}
