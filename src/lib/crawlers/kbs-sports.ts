import { Schedule } from "@/types/schedule";
import { parseMatchTitle, detectKoreanCommentary, isActualMatch } from "./parsers";

export async function crawlKbsSports(date: string): Promise<Schedule[]> {
  const dateCompact = date.replace(/-/g, "");
  const url = `https://www.kbsn.co.kr/schedule/index.html?wdate=${dateCompact}&bdcst_code=sports`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`KBS N SPORTS: HTTP ${res.status}`);
    return [];
  }

  const html = await res.text();
  const schedules: Schedule[] = [];

  // <li> 블록 추출
  const items = html.match(/<li class=""?>[\s\S]*?<\/li>/g) || [];

  for (const item of items) {
    // 생중계만 수집
    if (!item.includes("pro_info_live")) continue;

    // 시간 추출
    const timeMatch = item.match(/class="time">(.*?)<\/span>/);
    if (!timeMatch) continue;
    const time = timeMatch[1].trim();

    // 제목 + 에피소드 추출
    const titleMatch = item.match(/class="title col">([\s\S]*?)<\/div>/);
    if (!titleMatch) continue;
    const rawTitle = titleMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    // 날짜 정보 제거: "(26.04.07)" 등
    const title = rawTitle.replace(/\(\d{2}\.\d{2}\.\d{2}\)/, "").trim();

    if (!isActualMatch(title)) continue;

    const parsed = parseMatchTitle(title);
    const commentary = detectKoreanCommentary(title);

    schedules.push({
      id: `kbs-sports-${date}-${time}-${title.slice(0, 20)}`,
      date,
      time,
      sport: parsed.sport ?? "축구",
      league: parsed.league,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      platform: "KBS N SPORTS",
      // KBS N SPORTS는 국내 채널이므로 기본 한국어 해설
      koreanCommentary: commentary === "unknown" ? true : commentary,
    });
  }

  return schedules;
}
