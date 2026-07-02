/**
 * 월드컵 토너먼트 라운드별 편성글 자동 생성·갱신 스크립트.
 *
 *   npm run gen:worldcup-round
 *
 * worldcup.json에서 지금 다가오는 라운드(16강→8강→…)를 판별해
 * src/content/guides/<slug>.md 를 만들거나(없으면) 편성표 구간을 갱신한다(있으면).
 * 발행한 slug의 content-plan.md 큐 줄을 [x] 처리한다.
 *
 * 변경이 있으면 마지막 줄에 `CHANGED=1`, 없으면 `CHANGED=0`을 출력한다.
 * (GitHub Actions가 이걸로 커밋 여부를 판단한다.)
 */
import fs from "fs";
import path from "path";
import {
  type WcSchedule,
  type RoundTarget,
  kstTodayISO,
  selectTargetRounds,
  buildArticle,
  refreshArticle,
} from "../lib/guides/worldcup-round";

const ROOT = process.cwd();
const WORLDCUP_JSON = path.join(ROOT, "src/data/worldcup.json");
const GUIDES_DIR = path.join(ROOT, "src/content/guides");
const CONTENT_PLAN = path.join(ROOT, "docs/content-plan.md");

function loadSchedules(): WcSchedule[] {
  if (!fs.existsSync(WORLDCUP_JSON)) {
    throw new Error(`worldcup.json 없음: ${WORLDCUP_JSON}`);
  }
  const parsed = JSON.parse(fs.readFileSync(WORLDCUP_JSON, "utf8"));
  const arr = parsed?.schedules;
  if (!Array.isArray(arr)) {
    throw new Error("worldcup.json 구조 이상: schedules 배열이 없음");
  }
  return arr as WcSchedule[];
}

/** content-plan.md 에서 해당 slug 줄이 `- [ ]`면 `- [x]`로 바꾼다. 바꿨으면 true. */
function markQueueDone(slug: string): boolean {
  if (!fs.existsSync(CONTENT_PLAN)) return false;
  const text = fs.readFileSync(CONTENT_PLAN, "utf8");
  const lines = text.split("\n");
  let changed = false;
  const out = lines.map((line) => {
    if (line.includes(`(slug: ${slug})`) && /^- \[ \]/.test(line)) {
      changed = true;
      return line.replace(/^- \[ \]/, "- [x]");
    }
    return line;
  });
  if (changed) fs.writeFileSync(CONTENT_PLAN, out.join("\n"));
  return changed;
}

function done(changed: boolean): never {
  console.log(`CHANGED=${changed ? 1 : 0}`);
  process.exit(0);
}

function processRound(
  target: RoundTarget,
  schedules: WcSchedule[],
  today: string,
): boolean {
  const { round } = target;
  const built = buildArticle(target, schedules, today);
  const file = path.join(GUIDES_DIR, `${built.slug}.md`);
  let changed = false;

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, built.markdown);
    console.log(`신규 생성: ${built.slug}.md (${round}, ${target.matches.length}경기)`);
    changed = true;
  } else {
    const existing = fs.readFileSync(file, "utf8");
    const refreshed = refreshArticle(existing, target, schedules, today);
    if (refreshed) {
      fs.writeFileSync(file, refreshed);
      console.log(`편성표 갱신: ${built.slug}.md (${round})`);
      changed = true;
    } else {
      console.log(`변경 없음: ${built.slug}.md (${round})`);
    }
  }

  if (markQueueDone(built.slug)) {
    console.log(`content-plan 큐 처리: ${built.slug} → [x]`);
    changed = true;
  }
  return changed;
}

function main() {
  const schedules = loadSchedules();
  const today = kstTodayISO();

  const targets = selectTargetRounds(schedules, today);
  if (targets.length === 0) {
    console.log("발행 창이 열린 토너먼트 라운드 없음. 스킵.");
    done(false);
  }

  // 창이 열린 라운드를 전부 처리(단일 경기 결승이 3·4위전에 밀려 늦게 뜨는 문제 방지).
  let changed = false;
  for (const target of targets) {
    if (processRound(target, schedules, today)) changed = true;
  }

  done(changed);
}

main();
