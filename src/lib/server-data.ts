// 서버 컴포넌트 전용 데이터 로더. fs 직접 접근하므로 클라이언트에서 import 금지.
import fs from "fs";
import path from "path";
import type { ScheduleData } from "@/types/schedule";
import type { TeamRecordsData, TeamRecordsMap } from "@/types/team-record";
import type { ResultsData } from "@/types/results";

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

/** schedule.json 의 lastUpdated 만 필요한 곳(레이아웃 JSON-LD 등)용 경량 리더.
 *  schedule.json 전체를 모듈에 static import 하면 그 청크에 42KB가 묶이므로 런타임 읽기로 대체. */
export function loadScheduleLastUpdated(): string {
  try {
    const filePath = path.join(process.cwd(), "public", "schedule.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return (JSON.parse(raw) as { lastUpdated?: string }).lastUpdated ?? "";
  } catch {
    return "";
  }
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

/**
 * results-archive.json: 종료/취소 경기를 영구 누적한 파일.
 * results.json은 3일 윈도우라 대회 초반(예: 월드컵 6/12~14) 스코어가 빠지는데,
 * 아카이브엔 남아 있으므로 월드컵 전체 스코어를 채우는 데 사용한다.
 */
export function loadResultsArchive(): ResultsData | null {
  try {
    const filePath = path.join(process.cwd(), "public", "results-archive.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ResultsData;
  } catch {
    return null;
  }
}
