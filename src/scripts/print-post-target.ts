/**
 * 이 실행이 어느 날짜를 대상으로 게시하는지 로그에 남긴다.
 *
 * 2026-08-27 사고 때 로그 어디에도 대상 날짜가 없어서, 생성된 파일명
 * (`main-0829.png`)으로 역추적해야 했다. 그 한 줄이 있었으면 즉시 보였다.
 *
 * 저녁 사이클이 자정을 넘겨 밀린 경우(= 사이클 보정이 걸린 경우) 경고를 남기고
 * `GITHUB_STEP_SUMMARY` 에도 적는다. 게시는 막지 않는다 — 보정된 날짜가 맞기 때문.
 */
import fs from "fs";
import { kstNow, EVENING_CYCLE_START_HOUR } from "../lib/instagram";
import { currentCycle } from "../lib/post-slot";

const now = new Date();
const k = kstNow(now);
const pad = (n: number) => String(n).padStart(2, "0");
const kstStamp = `${k.getFullYear()}-${pad(k.getMonth() + 1)}-${pad(k.getDate())} ${pad(k.getHours())}:${pad(k.getMinutes())}`;

const offsetRaw = process.env.KST_OFFSET_DAYS ?? "(unset)";
const offset = Number.parseInt(process.env.KST_OFFSET_DAYS ?? "1", 10);
const { today, slot } = currentCycle(now);

const delayed = offset >= 1 && k.getHours() < EVENING_CYCLE_START_HOUR;

const lines = [
  `🗓️  대상 날짜: ${today}  (slot=${slot}, KST_OFFSET_DAYS=${offsetRaw})`,
  `⏱️  실행 시각: KST ${kstStamp}`,
];
if (delayed) {
  lines.push(
    `⚠️  저녁 사이클이 자정을 넘겨 발화했다(KST ${pad(k.getHours())}시 < ${EVENING_CYCLE_START_HOUR}시).`,
    `    전날 저녁분으로 보고 기준일을 하루 물렸다 → 대상 ${today}.`,
    `    보정이 없었다면 하루 앞선 날짜를 올렸을 상황이다(2026-08-27 사고).`,
  );
}

const out = lines.join("\n");
console.log(out);

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) fs.appendFileSync(summary, `${out}\n\n`);
