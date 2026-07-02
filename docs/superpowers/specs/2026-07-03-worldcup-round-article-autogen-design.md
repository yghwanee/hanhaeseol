# 월드컵 토너먼트 라운드별 편성글 자동 생성·발행 — 설계

- 날짜: 2026-07-03
- 상태: 설계(승인 대기)
- 관련: 작업32(가이드 섹션), 작업39/43(토픽 자동발행), 작업41(TournamentBracket), content-plan.md "일정 고정·결과 반영" 섹션

## 배경 / 문제

`/guide` 토픽 중 **토너먼트 라운드별 "일정·중계 총정리"** 글(16강·8강·4강·3·4위전·결승)은
결과·대진 반영이 필요하다는 이유로 지금까지 **사람 수동 발행**으로 남아 있었다.
그런데 topic·구조는 이미 정해져 있고, 대진·시간·채널 데이터는 `worldcup.json`에 모두 있다.

실제로 2026-07-03(오늘) 예정이던 16강 글이 아무도 안 써서 미발행 상태다.
(7/3은 content-plan 상 "자동 휴무일"+"수동 발행"이라 **의도된 공백** — 버그 아님.)

목표: 이 **고정 topic들을 데이터에서 자동 생성해 완전 자동 발행**한다.

## 데이터 사실 (검증됨, `src/data/worldcup.json`)

- 최상위 `{ lastUpdated, schedules: Schedule[] }`. `schedules` 104건.
- 라운드 라벨이 `league`에 들어 있음: `북중미 월드컵 {32강|16강|8강|4강|3·4위전|결승}`.
- 라운드별 현황(2026-07-03 기준):
  | 라운드 | 경기 | 미정 포함 | 기간 |
  |---|---|---|---|
  | 32강 | 16 | 0 | 6/29~7/4 |
  | 16강 | 8 | 3 | 7/5~7/8 |
  | 8강 | 4 | 4 | 7/10~7/12 |
  | 4강 | 2 | 2 | 7/15~7/16 |
  | 3·4위전 | 1 | 1 | 7/19 |
  | 결승 | 1 | 1 | 7/20 |
- 미정 대진은 `homeTeam`/`awayTeam` === `"미정"`. **어느 경기 승자인지 링크 정보는 데이터에 없음.**
- 3·4위전·결승 실제 날짜(7/19·7/20)가 content-plan의 7/16·7/17과 **다름** → 날짜는 데이터에서 산출(하드코딩 금지).
- 각 경기 필드: `id,date,time,sport,league,homeTeam,awayTeam,platform,koreanCommentary,homeEmblem,awayEmblem`.

## 접근법 결정

**데이터 템플릿 생성기 + 전용 GitHub Actions**로 간다. LLM 미사용.
- claude.ai 루틴 확장(②)·반자동(③)은 각각 "레포에서 못 만듦/사실검증 불확실", "완전 자동 요구와 불일치"로 탈락.
- 톤 위험 완화: 글 본질이 "일정·중계 **총정리**"라 표 중심이 자연스럽고, 여기에 **손으로 쓴 고정 도입/마무리 문단 + 데이터로 채우는 설명 문단**을 더해 블로그체를 유지한다.

## 결정된 요구사항 (사용자 확답)

1. 오늘(7/3) 16강 글 = **지금 생성기 첫 실행해 발행**.
2. 본문 = **표 + 문장 둘 다**(한눈 표 + 경기/일자별 설명 문단).
3. 미정 대진 = **양쪽 가능성 열어 정직하게**(예: "미정 vs 스페인 — 상대는 32강 결과로 확정"). 팀명 지어내지 않음.
4. 발행 = **완전 자동(main 직접 커밋) + 텔레그램 알림**. 사람 개입 0.

## 구성 요소

### 1) 생성기 `src/scripts/gen-worldcup-round-article.ts`

책임: worldcup.json → 라운드 판별 → `.md` 렌더 → 파일 쓰기 → content-plan `[x]`.

- **입력**: `src/data/worldcup.json`(편성), 필요 시 `results-archive.json`/results(끝난 경기 스코어 표기용, 선택). 리그 상수는 `worldcup.ts`와 동일 접미사 사용.
- **라운드 판별**: `ROUND_ORDER=['16강','8강','4강','3·4위전','결승']` 중,
  "첫 경기 date가 **오늘(KST) 기준 D-2 이내**로 다가왔고 아직 종료되지 않은" 가장 이른 라운드를 **대상 라운드**로 선택.
  (32강은 이미 진행 중인 예선 성격이라 대상 제외 — 첫 자동글은 16강.)
  대상 없으면 아무것도 안 하고 종료(exit 0).
- **slug 매핑**(라운드→content-plan slug, 고정 테이블):
  16강→`worldcup-round-of-16`, 8강→`worldcup-quarterfinals`, 4강→`worldcup-semifinals`,
  3·4위전→`worldcup-third-place`, 결승→`worldcup-final`.
- **렌더**:
  - frontmatter: `title/description/date/updated/category:"월드컵"/keywords`.
    `date`=최초 생성일, `updated`=이번 실행일(KST).
  - 본문 = 고정 도입 문단 + `<!-- wc:data:start -->`…`<!-- wc:data:end -->` 로 감싼 **데이터 구간** + 고정 마무리 문단.
  - 데이터 구간:
    - **편성표**(표): 날짜(KST)·시간(KST)·대진·채널·한국어해설(O)·무료여부.
    - **경기/일자별 설명 문단**(문장): 각 경기 한두 줄. 미정은 정직 처리 문구.
    - 끝난 경기(스코어 있으면) 결과 한 줄 반영은 선택(있으면 표기).
- **멱등/갱신**: 파일이 이미 있으면
  - 대상 라운드가 **아직 시작 전**이면 `wc:data` 마커 구간만 **재생성해 교체**(미정→확정 자동 반영). 도입/마무리·frontmatter title은 보존, `updated`만 갱신.
  - 라운드가 시작됨(첫 경기 지남)이면 더 이상 자동 갱신하지 않음(사람 몫).
  - 실제 내용 변화 없으면 파일을 건드리지 않음(불필요 커밋 방지).
- **content-plan.md**: 발행한 slug 줄이 `- [ ]`면 `- [x]`로. 변화 있을 때만.
- **출력(stdout/exit code)**: 무엇을 생성/갱신했는지 로그. "변경 없음"이면 워크플로가 커밋 스킵하도록 신호(예: 마지막 줄 `CHANGED=0/1` 또는 파일 변경으로 git이 판단).

### 2) 워크플로 `.github/workflows/worldcup-round-article.yml`

- **트리거**: 대회 기간 매일 KST 아침 cron(예: `40 22 * * *` = 07:40 KST, 편성 크롤 이후) + `workflow_dispatch`.
- **단계**: checkout(main) → setup-node → `npm ci` → `npm run gen:worldcup-round` →
  `git diff` 있으면 **`npm run build` 게이트** → 통과 시 `src/content/guides/*`+`docs/content-plan.md` 커밋·push(main) → 텔레그램 "발행/갱신됨". 빌드 실패면 커밋 안 하고 텔레그램 경고.
- 기존 crawl 워크플로처럼 main 직접 push(PR 불필요). `[vercel skip]` 미사용(발행은 배포돼야 함).
- concurrency 그룹으로 중복 실행 방지. push 재시도(rebase) 포함.

### 3) npm 스크립트

`package.json`에 `"gen:worldcup-round": "tsx src/scripts/gen-worldcup-round-article.ts"`
(기존 크롤 스크립트 실행 방식과 동일 러너 사용.)

## 데이터 흐름

```
worldcup.json ──▶ 생성기(라운드 판별·렌더·멱등 갱신)
                   ├──▶ src/content/guides/worldcup-<round>.md (신규/마커구간 갱신)
                   └──▶ docs/content-plan.md ([x] 처리)
                        │
GH Actions(매일 07:40 KST) ─ git diff? ─▶ npm run build ─통과─▶ commit+push main ─▶ Vercel 배포 ─▶ 텔레그램
```

## 오늘 즉시 처리

- 생성기 완성 후 로컬에서 `npm run gen:worldcup-round` 실행 → **16강 글 생성** → `npm run build` 확인 → main 커밋·push(사용자 승인 하에) → 발행.
- 16강 8경기 중 3경기(7/7·7/8) 미정 → 정직 처리 문구로 노출.

## 에러 처리 / 안전장치

- 대상 라운드 없음 → 조용히 exit 0(휴무).
- worldcup.json 없음/파싱 실패 → 비정상 종료(커밋 안 됨), 텔레그램 경고.
- 빌드 실패 → 커밋 차단(잘못된 글이 시간별 크롤까지 배포 얼리는 것 방지 — 작업39 교훈).
- 미정 팀명 절대 추측 금지(정직 처리만).

## 검증 (수용 기준)

- 생성기 단위: 16강 대상 판별, 미정 3경기 정직 문구, 표+문장 동시 출력, frontmatter 유효.
- 멱등: 두 번 실행 시 내용 동일하면 파일 무변경(git clean).
- 갱신: 미정 팀을 임의로 확정한 픽스처로 재실행 시 마커 구간만 바뀌고 도입/마무리 보존.
- 통합: `npm run build` 통과, `/guide/worldcup-round-of-16` 렌더, `/guide` 목록·월드컵 카테고리 노출.
- content-plan `worldcup-round-of-16` 줄 `[x]`.

## 범위 밖 (YAGNI)

- 미정 슬롯을 특정 32강 경기와 링크(브래킷 구조 데이터 없음 → 정직 처리로 대체).
- 32강(예선 성격) 자동글.
- 라운드 시작 후 결과 전면 반영 재작성(사람 몫).
- LLM 문장 생성.
```
