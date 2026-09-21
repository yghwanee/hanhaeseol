/**
 * 네이버 검색광고 키워드 도구(월간 검색수) 조회.
 *
 *   npm run keywords -- "오늘 야구 해설" "아시안게임 축구 일정" ...
 *   npm run keywords -- --file=docs/keyword-seeds.txt
 *   npm run keywords -- --related "야구 해설"      # 연관 키워드까지 펼쳐서 본다
 *
 * 왜 필요한가: 네이버 서치어드바이저는 **우리가 이미 노출된 쿼리**만 보여 준다. 아직 한 번도
 * 안 뜬 쿼리의 수요는 거기 안 나온다. 키워드 도구가 그 빈자리를 메운다.
 *
 * 🔴 API 이용료는 없다(광고를 집행할 때만 과금). 조회 한도는 넉넉하지만 1초에 여러 번
 * 때리면 429 가 난다 → 요청 사이에 간격을 둔다.
 *
 * 🔴 자격증명은 절대 찍지 않는다. `.env.local`/`.env`/OneDrive 공용 파일에서 읽는다.
 *   NAVER_SEARCHAD_CUSTOMER_ID · NAVER_SEARCHAD_ACCESS_LICENSE · NAVER_SEARCHAD_SECRET_KEY
 *
 * 🔴 반환값의 `monthlyPcQcCnt`/`monthlyMobileQcCnt` 는 **10 미만이면 문자열 `"< 10"`** 으로 온다.
 * 숫자로 바로 더하면 NaN 이 되거나 조용히 0 이 된다.
 */
import { loadEnv, describeEnvSources } from "@/lib/env/shared-env";
import crypto from "node:crypto";
import fs from "node:fs";

loadEnv();

const HOST = "https://api.searchad.naver.com";

type Row = {
  relKeyword: string;
  monthlyPcQcCnt: number | string;
  monthlyMobileQcCnt: number | string;
  compIdx: string;
};

function creds(): { customerId: string; license: string; secret: string } {
  const customerId = process.env.NAVER_SEARCHAD_CUSTOMER_ID ?? "";
  const license = process.env.NAVER_SEARCHAD_ACCESS_LICENSE ?? "";
  const secret = process.env.NAVER_SEARCHAD_SECRET_KEY ?? "";
  if (!customerId || !license || !secret) {
    throw new Error(
      `검색광고 자격증명이 없다(${describeEnvSources()}). ` +
        "NAVER_SEARCHAD_CUSTOMER_ID · NAVER_SEARCHAD_ACCESS_LICENSE · NAVER_SEARCHAD_SECRET_KEY 를 .env.local 에 넣을 것.",
    );
  }
  return { customerId, license, secret };
}

/** 검색광고 API 서명. `{timestamp}.{METHOD}.{path}` 를 HMAC-SHA256 하고 base64. */
function sign(secret: string, ts: string, method: string, path: string): string {
  return crypto.createHmac("sha256", secret).update(`${ts}.${method}.${path}`).digest("base64");
}

async function keywordTool(hints: string[]): Promise<Row[]> {
  const { customerId, license, secret } = creds();
  const path = "/keywordstool";
  const ts = String(Date.now());
  // 힌트 키워드는 공백을 빼고 대문자로 넣어야 매칭이 잘 된다(API 문서 권고).
  const query = new URLSearchParams({
    hintKeywords: hints.map((h) => h.replace(/\s+/g, "")).join(","),
    showDetail: "1",
  });
  const res = await fetch(`${HOST}${path}?${query}`, {
    headers: {
      "X-Timestamp": ts,
      "X-API-KEY": license,
      "X-Customer": customerId,
      "X-Signature": sign(secret, ts, "GET", path),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`keywordstool HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { keywordList?: Row[] };
  return json.keywordList ?? [];
}

/** `"< 10"` 을 숫자로. 10 미만은 9 로 본다(있다/없다만 가리면 된다). */
function n(v: number | string): number {
  if (typeof v === "number") return v;
  const m = v.match(/\d+/);
  return v.includes("<") ? 9 : m ? Number(m[0]) : 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const related = args.includes("--related");
  const fileArg = args.find((a) => a.startsWith("--file="));
  const seeds = [
    ...args.filter((a) => !a.startsWith("--")),
    ...(fileArg
      ? fs
          .readFileSync(fileArg.slice("--file=".length), "utf-8")
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#"))
      : []),
  ];
  if (seeds.length === 0) {
    console.error('키워드를 넘길 것: npm run keywords -- "오늘 야구 해설" 또는 --file=목록.txt');
    process.exit(1);
  }

  const wanted = new Set(seeds.map((s) => s.replace(/\s+/g, "")));
  const rows = new Map<string, Row>();
  // 힌트는 한 번에 5개까지.
  for (let i = 0; i < seeds.length; i += 5) {
    const chunk = seeds.slice(i, i + 5);
    try {
      for (const r of await keywordTool(chunk)) {
        if (!rows.has(r.relKeyword)) rows.set(r.relKeyword, r);
      }
    } catch (e) {
      console.error(`  ! ${chunk.join(", ")} → ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  const list = [...rows.values()]
    .map((r) => ({ kw: r.relKeyword, pc: n(r.monthlyPcQcCnt), mo: n(r.monthlyMobileQcCnt), comp: r.compIdx }))
    .map((r) => ({ ...r, total: r.pc + r.mo }))
    // 기본은 넘긴 키워드만. `--related` 면 연관 키워드까지 전부 본다.
    .filter((r) => related || wanted.has(r.kw.replace(/\s+/g, "")))
    .sort((a, b) => b.total - a.total);

  console.log(`검색량(월) · ${list.length}개 · ${describeEnvSources()}`);
  console.log("총합\tPC\t모바일\t경쟁\t키워드");
  for (const r of list) console.log(`${r.total}\t${r.pc}\t${r.mo}\t${r.comp}\t${r.kw}`);
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
