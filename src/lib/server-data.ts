// 서버 컴포넌트 전용 데이터 로더. fs 직접 접근하므로 클라이언트에서 import 금지.
import fs from "fs";
import path from "path";
import type { ScheduleData } from "@/types/schedule";
import type { TeamRecordsData, TeamRecordsMap } from "@/types/team-record";
import type { ResultsData } from "@/types/results";
import type { WorldCupStandings } from "@/types/worldcup";

export function loadScheduleData(): ScheduleData {
  const filePath = path.join(process.cwd(), "public", "schedule.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as ScheduleData;

  // 월드컵 편성은 별도 파일(worldcup.json)로 관리되며, 매시간 도는 일반 크롤러가
  // schedule.json을 덮어써도 살아남는다. 읽을 때 합쳐서 한 목록으로 노출한다.
  try {
    const wcPath = path.join(process.cwd(), "public", "worldcup.json");
    const wc = JSON.parse(fs.readFileSync(wcPath, "utf-8")) as ScheduleData;
    data.schedules = [...data.schedules, ...wc.schedules];
  } catch {
    // worldcup.json 없으면 무시
  }

  return data;
}

export function loadTeamRecords(): TeamRecordsMap {
  try {
    const filePath = path.join(process.cwd(), "public", "team-records.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return (JSON.parse(raw) as TeamRecordsData).records;
  } catch {
    return {};
  }
}

/** 월드컵 조별 순위. 크롤 전이면 없을 수 있음. */
export function loadWorldcupStandings(): WorldCupStandings | null {
  try {
    const filePath = path.join(process.cwd(), "public", "worldcup-standings.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as WorldCupStandings;
  } catch {
    return null;
  }
}

/** results.json은 1시간마다 갱신되며, 아직 한 번도 안 돈 상태에선 없을 수 있음. */
export function loadResults(): ResultsData | null {
  try {
    const filePath = path.join(process.cwd(), "public", "results.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ResultsData;
  } catch {
    return null;
  }
}
