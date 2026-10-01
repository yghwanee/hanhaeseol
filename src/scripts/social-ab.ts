/**
 * 커버 A/B 판정 — 사진 커버 vs 그래픽 커버의 쇼츠 조회수.
 *
 * `coverArm()`(reel-title-card.ts)이 대상 날짜의 일(日)로 팔을 가른다. 이 스크립트는
 * 채널 쇼츠 탭을 읽어 제목 꼬리의 `M/D(요일)` 에서 대상 날짜를 뽑고 팔별 중앙값을 낸다.
 *
 * 🔴 키가 필요 없다(공개 페이지의 accessibilityText). 그래서 로컬에서 바로 돈다.
 * 🔴 이틀이 안 지난 영상은 뺀다 — 미성숙 조회수로 결론을 냈다가 틀린 전례가 있다
 *    (2026-08-05 "4회"가 이틀 뒤 321회).
 * 🔴 대표팀 경기 날은 양쪽 팔 모두 그래픽이라 비교에서 뺀다.
 *
 * 실행: npm run social:ab
 */
import { coverArm } from "../lib/reel-title-card";

const CHANNEL = "https://www.youtube.com/@hanhaeseol/shorts";
/** 이 날짜(대상 날짜)부터 A/B 가 걸려 있다. 그 전 영상은 전부 사진 커버다. */
const AB_START = "2026-10-03";
const MATURE_DAYS = 2;

interface Row {
  target: string;
  views: number;
  title: string;
}

function parseViews(s: string): number {
  // "조회수 1.2천회" · "조회수 18회" · "조회수 없음" · "조회수 3만회"
  if (/없음/.test(s)) return 0;
  const m = /조회수\s*([\d.,]+)\s*(천|만)?\s*회/.exec(s);
  if (!m) return NaN;
  const n = Number(m[1].replace(/,/g, ""));
  return Math.round(n * (m[2] === "천" ? 1_000 : m[2] === "만" ? 10_000 : 1));
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

async function main() {
  const html = await fetch(CHANNEL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  }).then((r) => r.text());

  const kstNow = new Date(Date.now() + 9 * 3600_000);
  const year = kstNow.getUTCFullYear();
  const cutoff = new Date(kstNow.getTime() - MATURE_DAYS * 86400_000).toISOString().slice(0, 10);

  const rows: Row[] = [];
  for (const m of html.matchAll(/"accessibilityText":"([^"]*?#Shorts[^"]*?)"/g)) {
    const text = m[1];
    const d = /(\d{1,2})\/(\d{1,2})\([월화수목금토일]\)/.exec(text);
    if (!d) continue;
    const target = `${year}-${d[1].padStart(2, "0")}-${d[2].padStart(2, "0")}`;
    const views = parseViews(text);
    if (Number.isNaN(views)) continue;
    rows.push({ target, views, title: text.split(" #Shorts")[0] });
  }

  if (rows.length === 0) {
    console.log("쇼츠 목록을 못 읽었다(페이지 구조 변경 또는 차단). 브라우저로 직접 볼 것.");
    return;
  }

  const inTest = rows.filter((r) => r.target >= AB_START && r.target <= cutoff);
  const national = (r: Row) => /대한민국 vs| vs 대한민국/.test(r.title);
  const arms = { graphic: [] as Row[], photo: [] as Row[] };
  for (const r of inTest) {
    if (national(r)) continue;
    arms[coverArm(r.target)].push(r);
  }
  const before = rows.filter((r) => r.target < AB_START).map((r) => r.views);

  console.log(`쇼츠 ${rows.length}편 읽음 · A/B 대상(${AB_START}~${cutoff}, 대표팀 제외) ${arms.graphic.length + arms.photo.length}편`);
  console.log(`  이전(전부 사진 커버·옛 영상 포맷) 중앙값 ${median(before)} · ${before.length}편`);
  for (const arm of ["graphic", "photo"] as const) {
    const v = arms[arm].map((r) => r.views);
    console.log(`  ${arm === "graphic" ? "그래픽" : "사진  "} 중앙값 ${median(v)} · 평균 ${v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : NaN} · ${v.length}편`);
    for (const r of arms[arm]) console.log(`      ${r.target}  ${String(r.views).padStart(6)}  ${r.title.slice(0, 50)}`);
  }
  const nat = inTest.filter(national);
  if (nat.length) {
    console.log(`  대표팀 경기(비교 제외) ${nat.length}편`);
    for (const r of nat) console.log(`      ${r.target}  ${String(r.views).padStart(6)}  ${r.title.slice(0, 50)}`);
  }
  if (arms.graphic.length < 6 || arms.photo.length < 6) {
    console.log("  🔴 팔당 6편 미만 — 아직 판정하지 말 것(히어로가 매일 달라 편차가 크다).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
