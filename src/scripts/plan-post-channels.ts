/**
 * 이번 실행에서 **실제로 올려야 할 채널**을 정한다.
 *
 *   대상 = (요청한 채널) − (post-log 에 이미 올라간 채널)
 *
 * 🔴 이게 "부분 실패는 그것만 재시도" 를 자동으로 만든다. 5개 중 1개만 실패한 날
 *    워크플로를 **통째로** 다시 돌려도 성공한 4개는 여기서 빠지고 1개만 남는다.
 *    종전에는 사람이 `-f only=reel` 을 손으로 찍어야 했고, 안 찍으면 4개가 중복
 *    게시됐다(2026-09-01 삼중 게시의 다른 얼굴).
 *
 * 남는 게 하나도 없으면 `skip_all=true` 를 낸다 — 미디어 생성·업로드까지 통째로
 * 건너뛴다. 이건 정상 동작이라 **알리지 않는다**(알림 폭풍의 주범이었다).
 *
 * 출력(GITHUB_OUTPUT):
 *   channels   `,carousel,reel,`   (contains() 오탐 방지용 앞뒤 콤마)
 *   skip_all   true|false
 *   target     YYYY-MM-DD
 *   slot       morning|evening
 */
import fs from "node:fs";
import { currentCycle } from "../lib/post-slot";
import { missingChannels, wasPosted } from "../lib/post-log";
import { CHANNEL_LABEL, channelsForSlot, type Channel } from "../lib/post-report";
import { loadPostLog } from "./_post-log-store";

function out(key: string, value: string) {
  const f = process.env.GITHUB_OUTPUT;
  if (f) fs.appendFileSync(f, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
}

/** 게시 스크립트가 보고서 분모로 읽는다(HHS_CHANNELS). */
function exportEnv(key: string, value: string) {
  const f = process.env.GITHUB_ENV;
  if (f) fs.appendFileSync(f, `${key}=${value}
`);
}

function parseOnly(raw: string, fallback: Channel[]): Channel[] {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const picked: Channel[] = [];
  for (const token of trimmed.split(",").map((s) => s.trim())) {
    if (!token) continue;
    // 오타를 조용히 무시하면 그 채널이 통째로 안 올라간다. 명시적으로 죽인다.
    // 슬롯에 없는 채널(아침의 tiktok)도 여기서 걸린다 — 통과시키면 영영 안 올라가는
    // 채널을 감시견이 매일 "빠졌다"고 볼 수 있다.
    const c = fallback.find((x) => x === token);
    if (!c) throw new Error(`이 슬롯에서 쓸 수 없는 채널: ${token} (가능: ${fallback.join(", ")})`);
    if (!picked.includes(c)) picked.push(c);
  }
  // only="," 처럼 유효 채널이 0개면 "아무것도 안 올리고 성공" 으로 끝나 버린다.
  if (picked.length === 0) throw new Error(`only 에서 유효한 채널을 못 찾음: '${raw}'`);
  return picked;
}

async function main() {
  const { today, slot } = currentCycle();
  // 분모는 슬롯이 정한다(아침엔 틱톡 없음). only 입력은 그 안에서 더 좁히는 용도다.
  const requested = parseOnly(process.env.HHS_ONLY ?? "", channelsForSlot(slot));

  const log = await loadPostLog();
  const remaining = missingChannels(log, today, slot, requested);
  const already = requested.filter((c) => wasPosted(log, today, slot, c));

  console.log(`🗓️  대상 ${today} · slot=${slot}`);
  console.log(`   요청: ${requested.join(", ")}`);
  if (already.length > 0) {
    console.log(`   이미 게시됨(건너뜀): ${already.map((c) => CHANNEL_LABEL[c]).join(", ")}`);
  }
  console.log(
    remaining.length > 0
      ? `   이번에 올릴 것: ${remaining.map((c) => CHANNEL_LABEL[c]).join(", ")}`
      : "   올릴 것 없음 — 이번 실행은 아무것도 하지 않는다.",
  );

  out("target", today);
  out("slot", slot);
  out("channels", remaining.length > 0 ? `,${remaining.join(",")},` : ",");
  out("skip_all", remaining.length === 0 ? "true" : "false");
  // 보고서 분모는 "이번에 올릴 것" 이다. 이미 올라간 채널까지 분모에 넣으면
  // 재실행 보고가 매번 "5개 중 4개 안 올라감" 처럼 읽힌다.
  exportEnv("HHS_CHANNELS", remaining.length > 0 ? `,${remaining.join(",")},` : ",");

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    fs.appendFileSync(
      summary,
      `📋 ${today}(${slot}) — 올릴 것 ${remaining.length}개` +
        (already.length ? ` · 이미 올라감 ${already.length}개` : "") +
        "\n\n",
    );
  }
}

main().catch((e) => {
  console.error(`::error::${(e as Error).message}`);
  process.exit(1);
});
