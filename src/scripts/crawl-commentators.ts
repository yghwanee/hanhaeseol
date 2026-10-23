/**
 * 방송사 공식 해설진 명단 크롤 → src/data/commentators.json
 *
 * 왜 손으로 안 적는지·어느 방송사만 넣는지는 `src/lib/commentators.ts` 머리 주석.
 * 무료·인증 불필요. `crawl-korean-players.yml` 이 매일 같이 돌린다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseKbsnRoster, type CommentatorsData, type CommentatorSource } from "../lib/commentators";

const OUT = "src/data/commentators.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36";

const SOURCES: Array<{ platform: string; url: string; parse: (html: string) => CommentatorSource["groups"] }> = [
  { platform: "KBS N SPORTS", url: "https://www.kbsn.co.kr/section/index7.html", parse: parseKbsnRoster },
];

/** 이보다 적게 읽히면 페이지 구조가 바뀐 것이다 — 빈 명단을 덮어쓰지 않는다. */
const MIN_NAMES = 5;

async function main() {
  const prev = (() => {
    try {
      return JSON.parse(readFileSync(OUT, "utf8")) as CommentatorsData;
    } catch {
      return null;
    }
  })();

  const sources: CommentatorSource[] = [];
  const failures: string[] = [];
  for (const src of SOURCES) {
    try {
      const res = await fetch(src.url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const groups = src.parse(await res.text());
      const total = groups.reduce((n, g) => n + g.names.length, 0);
      if (total < MIN_NAMES) throw new Error(`이름 ${total}개뿐 — 페이지 구조가 바뀐 듯`);
      sources.push({ platform: src.platform, sourceUrl: src.url, groups });
      console.log(`✅ ${src.platform}: ${groups.map((g) => `${g.label} ${g.names.length}`).join(" · ")}`);
    } catch (e) {
      failures.push(`${src.platform}: ${(e as Error).message}`);
    }
  }

  if (failures.length > 0) {
    // 하나라도 실패하면 파일을 안 건드린다. checkedAt 이 그대로 늙어서 14일 뒤 화면에서 빠진다.
    for (const f of failures) console.error("❌", f);
    process.exit(1);
  }

  const same = prev && JSON.stringify(prev.sources) === JSON.stringify(sources);
  // 명단이 같아도 checkedAt 은 매일 갱신한다 — 그래야 낡음 판정이 "확인한 날" 기준이 된다.
  const out: CommentatorsData = { checkedAt: new Date().toISOString(), sources };
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(same ? "명단 변화 없음(확인일만 갱신)" : "명단 갱신");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
