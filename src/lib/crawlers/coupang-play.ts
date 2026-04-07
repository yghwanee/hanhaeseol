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

async function refreshPAT(): Promise<string | null> {
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
  console.error(`쿠팡 Step1: ${r1.status} → ${r1.headers.get("location") || "no redirect"}`);

  // Step 2: /home → P_AT in Set-Cookie
  const r2 = await fetch("https://www.coupangplay.com/home", {
    headers: { Cookie: cookies, "User-Agent": ua },
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  console.error(`쿠팡 Step2: ${r2.status}`);
  const allHeaders: string[] = [];
  for (const [k, v] of r2.headers.entries()) {
    if (k === "set-cookie") allHeaders.push(v.substring(0, 50));
    if (k === "set-cookie" && v.startsWith("P_AT=")) {
      return v.split(";")[0].replace("P_AT=", "");
    }
  }
  console.error(`쿠팡 Set-Cookie: ${allHeaders.length}개 → ${allHeaders.join(" | ")}`);

  return null;
}

export async function crawlCoupangPlay(date: string): Promise<Schedule[]> {
  const deviceId = process.env.COUPANG_DEVICE_ID;
  const memberSrl = process.env.COUPANG_MEMBER_SRL;
  const profileId = process.env.COUPANG_PROFILE_ID;

  if (!deviceId || !memberSrl || !profileId) {
    console.error("쿠팡플레이: 환경변수 미설정");
    return [];
  }

  const pAt = await refreshPAT();
  if (!pAt) {
    console.error("쿠팡플레이: 토큰 갱신 실패");
    return [];
  }

  const url = `https://www.coupangplay.com/api-discover/v1/sports/curated-schedule/events?base_date=${date}&unit=day&locale=ko&region=KR&scope=all&includeHighlights=false&includeSportsChannelContents=true`;

  const res = await fetch(url, {
    headers: {
      Cookie: `NEXT_LOCALE=ko; P_AT=${pAt}; device_id=${deviceId}; member_srl=${memberSrl}; PCID=17755361609406080915557`,
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15",
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
    },
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

  for (const event of events) {
    if (event.type !== "LIVE") continue;
    if (event.teams.length < 2) continue;

    const sport = SPORT_MAP[event.league.sportTypeName];
    if (!sport) continue;

    // UTC → KST
    const kst = new Date(event.start_at);
    const yyyy = kst.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric" }).replace(/[^0-9]/g, "");
    const mm = String(kst.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric" }).replace(/[^0-9]/g, "")).padStart(2, "0");
    const dd = String(kst.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", day: "numeric" }).replace(/[^0-9]/g, "")).padStart(2, "0");
    const itemDate = `${yyyy}-${mm}-${dd}`;

    if (itemDate !== date) continue;

    const hh = String(kst.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", hour12: false }).replace(/[^0-9]/g, "")).padStart(2, "0");
    const min = String(kst.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", minute: "numeric" }).replace(/[^0-9]/g, "")).padStart(2, "0");
    const time = `${hh}:${min}`;

    schedules.push({
      id: `coupang-${date}-${time}-${event.league.shortName}-${event.teams[0].name}-${event.teams[1].name}`,
      date,
      time,
      sport,
      league: event.league.name,
      homeTeam: event.teams[0].name,
      awayTeam: event.teams[1].name,
      platform: "쿠팡플레이",
      koreanCommentary: true,
    });
  }

  return schedules;
}
