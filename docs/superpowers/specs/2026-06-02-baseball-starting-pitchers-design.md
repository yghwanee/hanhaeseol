# 야구 선발투수 정보 표시 — 설계 문서

작성일: 2026-06-02
대상 기능: `/match/[slug]` 인사이트 페이지에 야구 경기 선발투수 매치업(이름 + 시즌 성적)을 구조화된 별도 필드로 표시.

## 1. 배경 / 목표

야구 관전의 핵심은 선발투수 맞대결이다. 현재 인사이트는 리그/순위/최근5경기/연승·연패/상대전적만 입력으로 쓰고 선발 정보는 없다. 신뢰 가능한 소스(네이버 스포츠)에서 예고 선발과 시즌 성적을 가져와 `/match` 페이지에 **사실 기반 구조화 필드**로 보여준다.

핵심 원칙(프로젝트 공통): **자본 0원.** 이 기능은 LLM을 쓰지 않고 네이버 공개 API만 사용하므로 과금이 없다.

## 2. 요구사항 (확정)

- 표시 형태: **구조화된 별도 필드** (인사이트 본문에 녹이는 방식 아님)
- 대상 리그: **KBO 1군 + MLB**
- 표시 위치: **`/match/[slug]` 인사이트 페이지** (메인 경기 카드 아님)
- 표시 성적: **ERA(평균자책점), 이닝수, 승-패, 탈삼진(K), WHIP**
- 미발표 처리: 데이터 없으면 **"선발 미발표"** 명시
- 데이터 구조 접근법: **별도 파일(`starters.json`) + 렌더 시 매칭** (접근법 A)
- 갱신 빈도: **하루 3회 — 오전 3시 / 오전 10시 / 오후 9시 KST**
- UI/UX: 깔끔하고 정보 과밀하지 않게 디자인 (§8)

## 3. 비목표 (YAGNI)

- 인사이트 프롬프트에 선발 주입(본문 정확도 향상) — 추후 별건
- 메인 페이지 경기 카드 표시 — 추후
- 퓨처스리그(2군) — 예고 선발 공식 발표 불안정, 대상 제외
- 상대팀 상대 ERA(`currentSeasonStatsOnOpponents`) — 데이터는 있으나 1차 범위에서 제외
- 타자/타선 정보(`topPlayer`, hotColdZone 등) — 제외

## 4. 데이터 소스 (검증 완료)

네이버 스포츠 게이트웨이 `https://api-gw.sports.naver.com` (헤더: 기존 `src/lib/standings/naver.ts`와 동일 — Referer `https://m.sports.naver.com/`, 모바일 UA).

1. **경기 목록**: `GET /schedule/games?categoryId={kbo|mlb}&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`
   → `result.games[]` 각 항목에 `gameId`, `gameDate`, `homeTeamName`, `awayTeamName`, `statusCode`, `reversedHomeAway`.
2. **경기 상세(선발+성적)**: `GET /schedule/games/{gameId}/preview`
   → `result.previewData.homeStarter` / `awayStarter`:
   - `playerInfo` (선발 이름)
   - `currentSeasonStats`: `era`, `inn2`("57 1/3"), `w`, `l`, `kk`(탈삼진), `whip`, `bb`, `gameCount` 등

검증 결과(2026-06-02 KIA:롯데, gameId `20260602LTHT02026`):
```
KIA 네일  : era 3.84, inn2 "63 1/3", w 2, l 4, kk 48, whip 1.11
롯데 나균안: era 3.45, inn2 "57 1/3", w 2, l 5, kk 48, whip 1.34
```
> 이름은 기본 엔드포인트 `GET /schedule/games/{gameId}`의 `homeStarterName`/`awayStarterName`로도 확보 가능(폴백). 구현 시 `preview.playerInfo`에서 이름 추출이 가능한지 확인하고, 안 되면 기본 엔드포인트 이름과 결합.

**MLB 주의**: 구조는 동일할 것으로 보이나 구현 시 `categoryId=mlb`로 실제 응답 확인 필요. MLB는 팀명이 한글(예: 다저스)로 올 가능성 → §6 정규화.

## 5. 데이터 모델

파일: `src/data/starters.json` (크롤러 생성, 페이지가 import).

홈/원정 방향 꼬임 방지를 위해 **방향 무관 키 + 팀명→선발 맵** 구조를 쓴다 (네이버 `reversedHomeAway` 플래그 때문).

```jsonc
{
  "lastUpdated": "2026-06-02T01:00:00.000Z",
  "starters": {
    // 키 = `${date}|${[teamA, teamB].sort().join("-")}`
    "2026-06-02|KIA-롯데": {
      "league": "kbo",
      "teams": {
        "KIA":  { "name": "네일",   "era": "3.84", "ip": "63 1/3", "w": 2, "l": 4, "so": 48, "whip": "1.11" },
        "롯데": { "name": "나균안", "era": "3.45", "ip": "57 1/3", "w": 2, "l": 5, "so": 48, "whip": "1.34" }
      }
    }
  }
}
```

TS 타입 (`src/types/starter.ts`):
```ts
export interface StarterStat {
  name: string;
  era: string;   // 문자열 보존 (네이버 원본 포맷)
  ip: string;    // "57 1/3"
  w: number;
  l: number;
  so: number;
  whip: string;
}
export interface MatchStarters {
  league: "kbo" | "mlb";
  teams: Record<string, StarterStat>; // teamName -> stat
}
export interface StartersData {
  lastUpdated: string;
  starters: Record<string, MatchStarters>;
}
```

빈 문자열/누락 성적은 저장하지 않거나 그대로 두되, 렌더에서 "미발표"로 처리(§6).

## 6. 크롤러 & 매칭

### 크롤러
- `src/lib/starters/naver.ts`: `fetchGameList(categoryId, fromDate, toDate)`, `fetchStarters(gameId)` — 네이버 호출/파싱. 기존 `standings/naver.ts`의 `naverGet`/헤더 패턴 재사용.
- `src/scripts/crawl-starters.ts` (`npm run crawl:starters`):
  - `[kbo, mlb]` × (오늘 ~ D+6) 범위로 경기 목록 수집
  - 각 gameId마다 `preview` 호출 → 이름+성적 추출 (호출 간 짧은 sleep, 예: 300~500ms)
  - 키 생성 후 `starters.json` 갱신 (기존 데이터 위에 덮어쓰기 — 매 실행 전체 재생성)

### 매칭 (렌더 시)
- `src/lib/starters/lookup.ts`: `buildKey(date, homeTeam, awayTeam)` = `${date}|${[home,away].sort().join("-")}`.
- `getStartersForMatch(schedule)`: sport === "야구"일 때만 조회. 키로 `starters.json` 조회 → `teams[homeTeam]`, `teams[awayTeam]` 반환.
- **팀명 정규화**: KBO는 스케줄·네이버 팀명이 일치(검증됨). MLB는 한/영 매핑 테이블(`MLB_TEAM_ALIASES`) 도입. 매칭 실패 시 **미발표**(잘못된 값 절대 표시 안 함).

## 7. 표시 위치 & 컴포넌트

- `src/app/match/[slug]/_components/MatchStarters.tsx` (서버 컴포넌트, props로 선발 데이터 받음).
- `page.tsx`에서 sport === "야구"일 때만 렌더, 인사이트 섹션 근처에 배치.
- **인사이트 노출 플래그(`NEXT_PUBLIC_INSIGHTS_ENABLED`)와 무관하게 표시** — 선발은 AI 생성물이 아니라 사실 데이터라 게이트 불필요.

## 8. UI/UX 디자인 (깔끔하게)

기존 다크모드 톤·Tailwind·카드 스타일과 일관되게. 정보 과밀 금지.

레이아웃: **VS 중심 대칭 2열**(원정 좌 / 홈 우), 모바일에선 세로 스택.

```
┌──────────────── 선발 매치업 ────────────────┐
│   롯데                              KIA      │
│   나균안            VS             네일       │
│   ERA 3.45                      ERA 3.84     │
│   2승 5패 · 57⅓이닝            2승 4패 · 63⅓이닝 │
│   48K · WHIP 1.34            48K · WHIP 1.11  │
└──────────────────────────────────────────────┘
```

디자인 규칙:
- 섹션 헤더 "선발 매치업" — 인사이트 섹션 헤더와 동일 위계/폰트.
- **ERA를 가장 크게**(핵심 지표), 나머지는 작은 보조 텍스트 + 가운뎃점(·)으로 구분해 한 줄로 묶기 → 줄 수 최소화.
- 이닝 분수는 유니코드(⅓, ⅔)로 변환해 "57 1/3" → "57⅓" 깔끔하게.
- 가운데 "VS"는 흐린 색 작은 라벨. 팀명은 강조.
- 다크모드 대비/여백 충분히, 카드 안에 과한 테두리·아이콘 지양.
- 반응형: 모바일 세로 스택 시 팀별 블록으로 분리, 폰트·패딩 축소(기존 반응형 규칙 따름).
- **미발표 상태**: 같은 카드 틀 유지하되 본문에 흐린 텍스트 "선발 미발표" 한 줄. 한쪽만 미발표면 그쪽만 "미발표".
- 선택된 성적이 일부 누락이면 있는 값만 가운뎃점으로 이어 표시(빈 항목은 생략, 레이아웃 안 깨짐).

## 9. 자동화

- 신규 워크플로우 `.github/workflows/crawl-starters.yml`.
- 스케줄: **KST 03:00 / 10:00 / 21:00** → UTC `0 18 * * *`(전날), `0 1 * * *`, `0 12 * * *` (정각 혼잡 회피 위해 분 단위 소폭 오프셋 가능, 예 `5 18`, `5 1`, `5 12`). GitHub Actions 크론은 지연될 수 있음(허용).
- 잡: checkout → setup-node → `npm ci` → `npm run crawl:starters` → 변경 시 `src/data/starters.json` 커밋·푸시.
- **텔레그램 알림 없음.** 이 워크플로우는 데이터 커밋만 한다(텔레그램은 인사이트 전용 별도 워크플로우).
- 비용 0원(네이버 공개 API, LLM 無).

## 10. 엣지 케이스

- 선발 빈값("")/경기 미존재 → 미발표
- 한쪽만 발표 → 발표된 쪽만 표시, 다른 쪽 "미발표"
- MLB 팀명 매칭 실패 → 미발표(틀린 값 금지)
- 퓨처스(2군) → `kbo`/`mlb` 카테고리만 긁어 자동 제외
- 경기 종료 후(`statusCode` FINAL 등) → 예고 선발 의미 퇴색하나, 페이지 자체가 과거 경기면 그대로 보여도 무방(추후 숨김 여부 결정 가능, 현재 범위 밖)
- 네이버 API 장애 → 크롤 실패 시 기존 `starters.json` 유지(덮어쓰기 안 함), 워크플로우는 다음 실행에서 복구

## 11. 테스트

- 단위: `buildKey` 정렬·동치성, MLB 팀명 정규화, `getStartersForMatch` 조회(픽스처 JSON), 이닝 분수 포맷 변환("57 1/3"→"57⅓").
- 파싱: 네이버 `preview` 응답 1건 픽스처로 `fetchStarters` 파싱 검증.
- 렌더: `MatchStarters` 컴포넌트 — 정상/한쪽미발표/전체미발표 3케이스 스냅샷 또는 RTL.

## 12. 리스크 / 열린 질문

- **현재 한국어해설 MLB 경기 존재 여부 미확인.** 없으면 MLB 표시 대상이 당장 없을 수 있음(설계는 대비, 실데이터는 경기 생길 때). 구현 초기에 schedule.json에서 야구·MLB·koreanCommentary 경기 유무 확인.
- MLB 팀명 한/영 매핑 테이블의 정확한 출처/키 확정 필요(구현 시 네이버 MLB 응답 기준).
- `preview.playerInfo`의 정확한 이름 필드 키 확인 필요(없으면 기본 엔드포인트 이름 폴백).
