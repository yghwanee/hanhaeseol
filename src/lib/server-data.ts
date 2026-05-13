// 서버 컴포넌트 전용 데이터 로더. fs 직접 접근하므로 클라이언트에서 import 금지.
import fs from "fs";
import path from "path";
import type { ScheduleData } from "@/types/schedule";
import type { TeamRecordsData, TeamRecordsMap } from "@/types/team-record";
import type { ResultsData } from "@/types/results";

export function loadScheduleData(): ScheduleData {
  const filePath = path.join(process.cwd(), "public", "schedule.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ScheduleData;
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
