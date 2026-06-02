# 매치 상세 페이지 — 팀별 최근 5경기 결과

## 목적

매치 상세 페이지의 AI 인사이트(최근폼/핵심매치업/관전포인트) 아래에, 양 팀 각각의
최근 5경기 결과(상대팀, 점수, 승/패)를 보여준다. 기존 "양 팀 시즌 성적" 카드는
최근 5경기를 WLWLW 색깔 점으로만 요약하므로, 실제 점수(몇대몇)와 상대를 보고 싶은
사용자의 요구를 충족한다.

## 데이터

- 소스: `src/data/results-archive.json` (이미 `page.tsx`에 import됨). `buildHeadToHead`와
  동일한 소스/패턴을 따른다.
- 커버리지 확인: KBO 54경기(5/19~5/31), MLB 299경기, 해외 축구 다수. 대부분의 경기에서
  팀별 최근 5경기 추출 가능. 데이터 없는 경우 섹션 숨김.

## 변경 1 — `src/lib/match-content/build.ts`

```ts
export interface RecentGame {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  result: "W" | "L" | "D"; // 카드 주인 팀(teamName) 기준
}

export function buildRecentGames(
  results: ResultsData | null,
  match: Schedule,
  teamName: string,
): RecentGame[]
```

- `categoriesForLeague(match.league)`로 카테고리 필터 → `status==='finished'` →
  `date < match.date` → `teamName`이 home 또는 away인 경기 → 날짜 내림차순 최근 5건.
- `result`는 teamName 관점: 이긴 경기 W, 진 경기 L, 동점 D.
- 점수는 실제 경기 그대로 `homeScore`/`awayScore` (홈-원정 순서 보존).

`MatchNarrative`에 `homeRecent: RecentGame[]`, `awayRecent: RecentGame[]` 추가.
`buildMatchNarrative`에서 두 팀에 대해 `buildRecentGames` 호출해 채운다.

## 변경 2 — `src/app/match/[slug]/_components/MatchRecentGames.tsx` (신규)

- props: `homeTeam`, `awayTeam`, `homeRecent`, `awayRecent`, `findTeamLogo(name)=>string|null`.
- `homeRecent`와 `awayRecent`가 모두 비면 `null` 반환(섹션 숨김).
- 제목 "최근 5경기". 팀별 카드 하나씩. 각 경기 한 줄:
  - **날짜**(맨 앞, `formatDateHeader`)
  - **양 팀 로고 둘 다** + 팀명 (`TeamLogo` ~20px, 폴백 내장)
  - **점수**: 메인 카드 스타일 — `홈 - 원정`, mono bold, 진 쪽 텍스트 `text-zinc-500`로 흐리게
  - **승/패 뱃지**(맨 끝): 카드 주인 팀 기준 승(emerald)/패(rose)/무(zinc)

## 변경 3 — `src/app/match/[slug]/page.tsx`

`{insight && <MatchInsightSection .../>}` 와 `<MatchContextSection .../>` 사이에
`<MatchRecentGames ... />` 렌더. `findTeamLogo`는 같은 파일의 기존 헬퍼 전달.

## 건드리지 않는 것

- 기존 "양 팀 시즌 성적" 카드의 WLWLW 색깔 점은 그대로 유지(빠른 요약).
- 결과 소스는 `resultsArchive` 단일. 별도 results.json 병합 안 함(기존 패턴 유지).

## 검증

`npm run build` (tsc 포함) 통과. 매치 페이지에서 KBO 경기로 5경기 행 렌더 확인.
