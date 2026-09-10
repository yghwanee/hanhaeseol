/**
 * Vercel 사용량 실측 — Hobby 한도 대비 어디쯤인지 한 화면으로 본다.
 *
 * 🔴 왜 있나 (2026-09-10)
 * 다운그레이드 가부를 눈대중으로 판단하다 두 번 틀렸다. Vercel 대시보드는 열어 봐야 하고
 * `vercel` CLI 에는 usage 명령이 없다. Observability API 로 직접 뽑는다.
 *
 * 🔴 계량기가 둘이라는 걸 잊지 말 것.
 *   - Active CPU  : 렌더가 태우는 CPU. 2026-09-10 이전 월 7.75 CPU-hr (한도 4 의 194%).
 *   - Fast Origin Transfer : 응답 바이트. **2026-08-18 에 실제로 계정을 잠근 건 이쪽**이다.
 *     CPU 를 아무리 줄여도 FOT 는 안 준다 — 서로 다른 축이다.
 *
 * 인증: `vercel login` 한 PC 의 CLI 토큰을 그대로 쓴다. 없으면 VERCEL_TOKEN 환경변수.
 * 🔴 이 레포는 public 이다. 토큰을 이 파일에 적지 말 것.
 *
 * 사용:
 *   npm run usage           # 이번 청구주기 요약 + 최근 14일 일자별 CPU
 *   npm run usage -- 30     # 일자별 구간을 30일로
 *
 * 🔴 Observability 쿼리는 **팀당 하루 500회** 다. 이 스크립트 1회가 대략
 *    (지표 9개 × 조각 6~8) + 일자수 = 70~90회를 쓴다. 하루에 대여섯 번이 상한이다.
 *    한도를 넘기면 429 가 오고, 그걸 0 으로 삼키면 "사용량이 줄었다"는 정반대
 *    결론이 난다 — 그래서 429 는 재시도하지 않고 즉시 실패시킨다.
 */
import fs from "fs";
import path from "path";
import os from "os";

const API = "https://api.vercel.com";
const DAY_MS = 86_400_000;

/** Hobby 주기 한도. 넘기면 배포·서빙이 멈춘다(초과 청구가 아니다). */
const HOBBY = {
  activeCpuHours: 4,
  provisionedMemoryGbHours: 360,
  invocations: 1_000_000,
  fastDataTransferGb: 100,
  fastOriginTransferGb: 10,
};

function readToken(): string {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  // CLI 가 실제로 쓰는 경로. Windows 는 xdg.data 쪽이 최신이고, Data/ 쪽엔 만료된
  // 사본이 남아 있을 수 있다(2026-09-10 실측) — 그래서 xdg 를 먼저 본다.
  const home = os.homedir();
  const candidates = [
    path.join(home, "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json"),
    path.join(home, "AppData", "Roaming", "com.vercel.cli", "Data", "auth.json"),
    path.join(home, ".local", "share", "com.vercel.cli", "auth.json"),
    path.join(home, "Library", "Application Support", "com.vercel.cli", "auth.json"),
  ];
  for (const p of candidates) {
    try {
      const t = (JSON.parse(fs.readFileSync(p, "utf-8")) as { token?: string }).token;
      if (t) return t;
    } catch {
      /* 다음 후보 */
    }
  }
  throw new Error(
    "Vercel 토큰을 못 찾았다. `vercel login` 을 하거나 VERCEL_TOKEN 을 설정할 것.",
  );
}

const token = readToken();
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function api<T>(pathname: string): Promise<T> {
  const r = await fetch(`${API}/${pathname}`, { headers });
  if (!r.ok) throw new Error(`${pathname} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T;
}

type Team = { id: string; slug: string; billing?: { plan?: string; period?: { start: number; end: number } } };

/**
 * Observability 쿼리. 긴 구간은 서버가 408 로 끊으므로 조각내서 합친다.
 * 🔴 재시도 없이 쓰면 조용히 0 이 섞인다 — 실패한 조각 수를 반드시 같이 돌려준다.
 */
async function sumMetric(
  ownerId: string,
  metric: string,
  startMs: number,
  endMs: number,
  chunkDays = 4,
): Promise<{ total: number; failedChunks: number }> {
  let total = 0;
  let failedChunks = 0;
  for (let t = startMs; t < endMs; t += chunkDays * DAY_MS) {
    const body = {
      metric,
      scope: { type: "owner", ownerId },
      aggregation: "sum",
      startTime: new Date(t).toISOString(),
      endTime: new Date(Math.min(t + chunkDays * DAY_MS, endMs)).toISOString(),
    };
    let ok = false;
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      const r = await fetch(`${API}/v2/observability/query?teamId=${ownerId}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const { data } = (await r.json()) as { data?: Record<string, number | string>[] };
        for (const row of data ?? []) {
          const key = Object.keys(row).find((k) => k !== "timestamp");
          if (key) total += Number(row[key] ?? 0);
        }
        ok = true;
      } else if (r.status === 429) {
        // 🔴 일일 쿼리 한도(팀당 500회/일)를 넘기면 재시도해도 소용없다. 그냥 던진다 —
        // 조용히 0 으로 채우면 "사용량이 줄었다"는 정반대 결론이 나온다(2026-09-10 실측).
        const body = (await r.json().catch(() => ({}))) as {
          error?: { limit?: { max?: number; count?: number; reset?: number } };
        };
        const lim = body.error?.limit;
        throw new Error(
          `Observability 일일 쿼리 한도 소진 (${lim?.count ?? "?"}/${lim?.max ?? 500}회).` +
            (lim?.reset ? ` 리셋 ${new Date(lim.reset + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ")} KST.` : "") +
            " 그때 다시 돌릴 것.",
        );
      } else {
        await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      }
    }
    if (!ok) failedChunks++;
  }
  return { total, failedChunks };
}

/**
 * 동시 실행 개수를 묶는다.
 * 🔴 9개를 한꺼번에 던지면 Observability 가 408(query_timeout)로 조각을 통째로 버린다
 * (2026-09-10 실측: 57조각 실패 → 전부 0). 순차는 5분을 넘긴다. 3이 실측으로 맞았다.
 */
async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

function bar(pct: number): string {
  const filled = Math.min(20, Math.round(pct / 5));
  return "█".repeat(filled) + "·".repeat(Math.max(0, 20 - filled));
}

function row(label: string, used: number, cap: number, unit: string): string {
  const pct = (used / cap) * 100;
  const flag = pct >= 100 ? "🔴" : pct >= 80 ? "🟠" : "✅";
  return `${flag} ${label.padEnd(24)} ${used.toFixed(2).padStart(9)} / ${cap} ${unit.padEnd(8)} ${bar(pct)} ${pct.toFixed(0)}%`;
}

async function main(): Promise<void> {
  const dailyDays = Number(process.argv[2] ?? 14);

  const { teams } = await api<{ teams: Team[] }>("v2/teams?limit=20");
  const team = teams[0];
  if (!team) throw new Error("팀을 못 찾았다.");

  const period = team.billing?.period;
  const startMs = period?.start ?? Date.now() - 30 * DAY_MS;
  const endMs = Math.min(period?.end ?? Date.now(), Date.now());
  const fullEnd = period?.end ?? Date.now();
  const elapsedDays = (endMs - startMs) / DAY_MS;
  const periodDays = (fullEnd - startMs) / DAY_MS;
  const scale = periodDays / elapsedDays; // 월 환산 배수

  console.log(`팀 ${team.slug} · 플랜 ${team.billing?.plan ?? "?"}`);
  console.log(
    `주기 ${new Date(startMs).toISOString().slice(0, 10)} ~ ${new Date(fullEnd).toISOString().slice(0, 10)}` +
      ` (${elapsedDays.toFixed(1)}/${periodDays.toFixed(0)}일 경과, 월 환산 ×${scale.toFixed(2)})\n`,
  );

  const metrics = {
    cpuMs: "vercel.function_invocation.function_cpu_time_ms",
    mwCpuMs: "vercel.middleware_invocation.function_cpu_time_ms",
    memGbHr: "vercel.function_invocation.function_duration_gbhr",
    invocations: "vercel.function_invocation.count",
    fdtBytes: "vercel.request.fdt_total_bytes",
    fotFnBytes: "vercel.function_invocation.fot_total_bytes",
    fotMwBytes: "vercel.middleware_invocation.fot_total_bytes",
    isrReadBytes: "vercel.isr_operation.read_bytes",
    isrWriteBytes: "vercel.isr_operation.write_bytes",
  } as const;

  // 🔴 순차로 돌리면 9개 × 조각 6개 × (408 재시도 1.5초) 로 5분을 넘겨 harness 가
  // 백그라운드로 돌려 버린다(2026-09-10 실측). 지표끼리는 독립이라 같이 던진다.
  const entries = Object.entries(metrics);
  const results = await pooled(entries, 3, ([, metric]) =>
    sumMetric(team.id, metric, startMs, endMs),
  );
  const got: Record<string, number> = {};
  let failed = 0;
  entries.forEach(([name], i) => {
    got[name] = results[i].total;
    failed += results[i].failedChunks;
  });
  if (failed > 0) console.log(`⚠️  쿼리 조각 ${failed}개 실패 — 아래 숫자는 과소집계다.\n`);

  const cpuHr = ((got.cpuMs + got.mwCpuMs) / 3_600_000) * scale;
  const memGbHr = got.memGbHr * scale;
  const inv = got.invocations * scale;
  const fdtGb = (got.fdtBytes / 1e9) * scale;
  // 🔴 FOT 는 함수 + 미들웨어 + ISR(Data Cache) 다. Vercel 문서가 ISR 을 명시적으로 포함한다.
  const fotGb = ((got.fotFnBytes + got.fotMwBytes + got.isrReadBytes + got.isrWriteBytes) / 1e9) * scale;

  console.log("── 월 환산 vs Hobby 한도 ──");
  console.log(row("Active CPU", cpuHr, HOBBY.activeCpuHours, "CPU-hr"));
  console.log(row("Fast Origin Transfer", fotGb, HOBBY.fastOriginTransferGb, "GB"));
  console.log(row("Fast Data Transfer", fdtGb, HOBBY.fastDataTransferGb, "GB"));
  console.log(row("Provisioned Memory", memGbHr, HOBBY.provisionedMemoryGbHours, "GB-hr"));
  console.log(row("Invocations", inv / 1000, HOBBY.invocations / 1000, "K회"));
  console.log(
    `\n   FOT 내역: 함수 ${((got.fotFnBytes / 1e9) * scale).toFixed(2)}` +
      ` + 미들웨어 ${((got.fotMwBytes / 1e9) * scale).toFixed(2)}` +
      ` + ISR읽기 ${((got.isrReadBytes / 1e9) * scale).toFixed(2)}` +
      ` + ISR쓰기 ${((got.isrWriteBytes / 1e9) * scale).toFixed(2)} GB`,
  );

  console.log(`\n── 일자별 Active CPU (최근 ${dailyDays}일, KST 기준) ──`);
  console.log("한도 4 CPU-hr/주기 → 하루 평균 0.13 아래여야 31일을 버틴다.\n");
  const kstMidnightUtc = (daysAgo: number): number => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600_000);
    const dayStartKst = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
    return dayStartKst - 9 * 3600_000 - daysAgo * DAY_MS;
  };
  const days = Array.from({ length: dailyDays }, (_, i) => kstMidnightUtc(dailyDays - i));
  const daily = await pooled(days, 3, (s) => sumMetric(team.id, metrics.cpuMs, s, s + DAY_MS, 1));
  days.forEach((s, i) => {
    const hr = daily[i].total / 3_600_000;
    const label = new Date(s + 9 * 3600_000).toISOString().slice(5, 10);
    const flag = hr > 0.13 ? "🔴" : "✅";
    console.log(`  ${label}  ${hr.toFixed(3)} CPU-hr  ${flag}  ${"█".repeat(Math.round(hr * 60))}`);
  });
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
