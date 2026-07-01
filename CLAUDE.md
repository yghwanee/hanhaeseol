# 한해설 (HanHaesul) - 스포츠 중계 편성표 서비스

## 작업 원칙

- **속단 금지.** 로그에 에러/경고 문자열이 보인다고 해서 "문제의 원인"이라고 결론 내지 말 것. 로그는 증상일 뿐이고, 실제 현상(피드가 정말 안 올라갔는지, DB에 정말 없는지 등)을 먼저 확인해야 함. 코드 "수정 제안"을 바로 꺼내는 건 그 다음.
- 사용자가 현상을 보고하면 ①실제 상태 확인 → ②가설 → ③검증 → ④원인 확정 → ⑤제안 순서로. 로그만 보고 ④~⑤로 건너뛰지 말 것.
- 특히 "폴백/복구" 같은 방어 로직을 만났을 때, 그게 버그라고 단정하지 말 것. 의도된 동작일 가능성이 높음.

## 대화 종료 시 자동 정리 (기본 동작)

사용자가 종료 신호("끝내자", "여기까지", "이만", "ㅇㅋ 끝" 등)를 보내면, 시키지 않아도 기본으로:
1. **메모리 갱신** — 앞으로 도움될 사실/결정/피드백을 auto-memory에 반영(중복은 갱신, 틀린 건 삭제, MEMORY.md 인덱스도 함께). 코드/깃으로 이미 알 수 있는 것·이 대화에서만 의미 있는 것은 저장 X.
2. **CLAUDE.md 정비** — 이 파일에서 오래되거나 틀린 서술을 정정·반영. 단순 분량 늘리기 X.
3. 무엇을 갱신/정정했는지 한두 줄로 요약 보고하고 끝낸다.

(best-effort 상시 지침. 종료 신호 없이 끊기면 미동작. 커밋·푸시 등 외부 변경은 별도 요청 시에만.)

## 프로젝트 개요

여러 스포츠 중계 플랫폼의 편성표를 한곳에 모아 보여주는 웹 서비스.
**핵심 기능**: 각 경기의 [한국어해설] 여부를 명확하게 표시하여, 사용자가 한국어 해설이 있는 중계를 쉽게 찾을 수 있도록 한다.

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Directory**: `src/` 디렉토리 구조 사용
- **자동화**: GitHub Actions — 편성·결과·순위·선발투수·월드컵·인사이트 크롤 + 소셜 3채널(인스타·유튜브 쇼츠·틱톡) 하루 2회 자동 게시

## 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx           # 루트 레이아웃 (다크모드 기본, lang="ko")
│   ├── page.tsx             # 메인 페이지 (클라이언트 컴포넌트)
│   ├── globals.css          # 글로벌 스타일
│   └── fonts/               # Geist 폰트
├── data/
│   └── schedule.json        # 크롤러가 생성하는 편성 데이터
├── lib/
│   └── crawlers/
│       ├── index.ts         # 크롤러 통합 + 필터링
│       ├── parsers.ts       # 제목 파싱, 리그명 정규화, 종목 감지
│       ├── spotv-now.ts     # SPOTV NOW API 크롤러
│       ├── spotv-tv.ts      # SPOTV/SPOTV2 TV 채널 크롤러
│       ├── mbc-sports.ts    # MBC SPORTS+ 크롤러
│       ├── tvn-sports.ts    # tvN SPORTS 크롤러
│       ├── sbs-sports.ts    # SBS Sports 크롤러
│       ├── kbs-sports.ts    # KBS N SPORTS 크롤러
│       ├── apple-tv.ts     # Apple TV+ 크롤러
│       ├── coupang-play.ts # 쿠팡플레이 크롤러
│       ├── tving.ts        # 티빙 크롤러
│       └── worldcup.ts     # 북중미 월드컵(네이버) 크롤러
├── content/
│   └── guides/             # 한해설 Topic 에디토리얼 글(*.md)
├── scripts/
│   └── crawl.ts             # 크롤링 실행 스크립트 (외 결과/순위/선발/인사이트/소셜 게시 다수)
└── types/
    └── schedule.ts          # Schedule, ScheduleData, Sport, Platform 타입
```

## 플랫폼 (10개)

| 구분 | 플랫폼 | 크롤러 상태 |
|------|--------|------------|
| OTT | SPOTV NOW | 구현 완료 (API, 한국어해설 자동 판별) |
| OTT | 쿠팡플레이 | 구현 완료 (API, CT_LSID 토큰 자동 갱신) |
| OTT | 티빙 | 구현 완료 (공개 API, 인증 불필요) |
| OTT | Apple TV+ | 구현 완료 (UTS API, 현지해설만) |
| TV | SPOTV | 구현 완료 (JSON) |
| TV | SPOTV2 | 구현 완료 (JSON) |
| TV | tvN SPORTS | 구현 완료 (HTML 파싱) |
| TV | KBS N SPORTS | 구현 완료 (HTML 파싱) |
| TV | MBC SPORTS+ | 구현 완료 (POST API) |
| TV | SBS Sports | 구현 완료 (정적 JSON API) |

## 종목

축구, 야구, 농구, 배구 (4개만)

## 메인 페이지 기능

- **날짜 탭**: 오늘부터 7일간, 오늘 기본 선택
- **필터**: 종목(5개), 플랫폼(11개, 좌우 화살표 스크롤), 해설(전체/한국어해설만)
- **경기 카드**: 시간, 리그, 홈 VS 원정, 플랫폼 뱃지, 상태 뱃지
- **상태 뱃지**: 초록(한국어해설) / 빨강(현지해설) / 노랑(확인중) / 회색(경기 종료)
- **경기 종료 판단**: 종목별 예상 시간 (축구 2.5h, 야구 4.5h, 농구 3h, 배구 3h)
- **한국어해설 자동 판별**: SPOTV NOW language 필드 + 국내 리그 자동 true

## 크롤링

- `npm run crawl` → 오늘부터 7일치 크롤링 → `schedule.json` 갱신
- GitHub Actions 워크플로우: 편성(`crawl.yml`, KST 08:18 + 백업 10:48·13:48) / 결과·기록·월드컵(`crawl-results.yml`, 매시 13·43분) / 순위(`crawl-standings.yml`) / 선발투수 / 인사이트 생성·알림 / 소셜 오전(`instagram-morning.yml`)·저녁(`instagram.yml`) — 각각 인스타(캐러셀+릴스+스토리)+유튜브 쇼츠+틱톡 게시. 편성 갱신 시 텔레그램 알림
- 결과(`results.json`)는 어제~내일 3일 윈도우로 통째 덮어쓰기, 과거 종료경기는 `results-archive.json`에 영구 누적
- 비경기 콘텐츠(하이라이트, 시상식, 스포타임 등) 자동 제외
- SPOTV TV는 LIVE만 수집 (녹화 본방송 제외)

## 작업 진행 상황

### 완료된 작업
1. 프로젝트 초기 설정 (Next.js 14 + TypeScript + Tailwind CSS)
2. 타입 정의 (Sport, Platform, Schedule, ScheduleData)
3. 메인 페이지 UI (필터링, 경기 카드, 다크모드, 반응형)
4. 크롤러 9개 구현 (SPOTV NOW, SPOTV/SPOTV2, MBC SPORTS+, tvN SPORTS, SBS Sports, KBS N SPORTS, Apple TV+, 쿠팡플레이, 티빙)
5. 리그명/팀명 파싱 정규화
6. 경기 종료 표시 (종목별 예상 시간)
7. GitHub Actions 자동화 설정
8. hydration 버그 수정
9. GitHub Actions 워크플로우 수정 (push 권한, actions v6 업그레이드, pull --rebase 추가)
10. 헤더 UI 개선 (한해설 + 한국어 해설 편성표 한 줄 배치, 텍스트 크기 확대, 여백 조정)
11. 날짜 탭 UI 개선 (grid 균등 분할, 라운드 테두리, 토/일 색상 점 표시)
12. 필터 UI 리팩토링 (필터 → 날짜 탭 순서 변경, 종목/플랫폼/해설 라벨 가시성 개선)
13. 플랫폼 필터 펼침/접힘 방식으로 변경 (PC/모바일 분리 구현)
14. 해설 필터 3분할 (전체 / 한국어 해설 / 현지 해설)
15. 종목별 아이콘 표시 및 경기 수 오른쪽 정렬
16. 반응형 레이아웃 적용 (모바일: 가로 스크롤 날짜 탭, 축소된 폰트/패딩, 플랫폼 flex-wrap)
17. 로고/아이콘/파비콘 추가 (public/logo.png, icon.png)
18. 안내 모달 추가 (i 버튼 → 편성표 출처 안내)
19. SBS Sports 크롤러 구현 (정적 JSON API: static.cloud.sbs.co.kr)
20. AFC 대회명 파싱 개선 (parsers.ts)
21. GitHub Actions 크론 정각 회피 (00분 → 07분)
22. KBS N SPORTS 크롤러 구현 (HTML 파싱: kbsn.co.kr/schedule)
23. Apple TV+ 크롤러 구현 (UTS API: tv.apple.com, JWT 토큰 자동 추출)
24. 쿠팡플레이 크롤러 구현 (api-discover API, CT_LSID 기반 P_AT 토큰 자동 갱신)
25. 종목별 아이콘 동적 표시 (필터링된 경기에 포함된 종목만 표시)
26. 티빙 크롤러 구현 (BFF API: gw.tving.com, KBO+KBL, 인증 불필요)
27. GitHub Actions 스케줄러 수정 (KST 08:18 하루 1회)
28. 텔레그램 알림 연동 (편성표 업데이트 시 자동 알림)
29. AI 관전 포인트 (Match Insights) 인프라 구축 — Gemini 2.0 Flash 무료 티어 + GitHub Actions 자동화. /match/[slug]에 인사이트 섹션 + Article JSON-LD. `NEXT_PUBLIC_INSIGHTS_ENABLED` 환경변수로 점진 롤아웃. Phase 1 = 운영자 검수 단계.
30. 북중미 월드컵 연동 — 편성/순위 분리 관리(`worldcup.json`/`worldcup-standings.json`), `/worldcup` 조별 순위 페이지 + 메인 월드컵 뷰(오늘 날짜 자동 포커싱). 순위 시간별 갱신 + 진행중 경기 라이브 오염 가드(승+무+패!=경기수 조는 직전 스냅샷 유지). 과거 스코어는 archive 머지로 표시.
31. 축구 득점자·득점시간 표시 — 네이버 `game.scorers`(상세 호출) 수집해 `MatchResult.goals`에 저장. 카드 하단·매치페이지에 홈/원정 2열 표시(축구 종료+라이브). 모든 축구 카테고리 적용. 지난 월드컵 백필(`npm run backfill:worldcup-goals`).
32. 한해설 Topic 에디토리얼 섹션 — `/guide`(목록)+`/guide/[slug]`(본문, NewsArticle JSON-LD). 글 = `src/content/guides/*.md`(marked + @tailwindcss/typography). 메인 헤더·전역 푸터에 "한해설 Topic" 진입 버튼. AdSense 4차 거절 후 "자동집계 사이트에 사람이 쓴 고유 콘텐츠가 없다" 문제 대응(트래픽·AdSense 공통 레버). 톤 규칙은 `docs/guide-style.md`.
33. 평일 자동 초안 파이프라인 — 클라우드 루틴(claude.ai routine `trig_01BDiRqeDKktbJ8WhrbUqrKM`)이 `docs/content-plan.md` 큐 + `docs/guide-style.md` 톤으로 초안 작성 → `draft/*` PR. `.github/workflows/notify-draft-pr.yml`가 텔레그램 알림. 사람 검수 후 머지 = 발행. **2026-06-29 ON. cron `30 21 * * 1-4`=화~금 6:30 KST**(월요일 제외 — 월은 글감 받아 사람+클로드가 1편 즉시 발행=수동, 화~금 4편 자동 = 주 5편). 매 실행 step0에서 content-plan.md "자동 휴무일"이면 스킵, "★ 월드컵 우선" 섹션만 선택("일정 고정·결과 반영"/"월드컵 이후" 섹션은 자동 제외).
34. 주간 글감 제안 루틴 + 월드컵 우선 운영 (2026-06-25) — 클라우드 루틴 2번째(매주 월 6:30 KST, enabled)가 월드컵 글감 10개를 `[글감]` 이슈로 생성 → `.github/workflows/notify-ideas.yml`(issues 다리)가 텔레그램. 사람이 5개 골라 큐 세팅(목표 주 5개 발행). `content-plan.md`는 "월드컵 우선(~7/19)" 섹션 + "월드컵 이후(7/19~)" 섹션으로 분리, 자동초안은 대회 끝까지 월드컵만 고름. 결과/대진글(한국전 결과 등)은 자동 아닌 사람 수동. 두 텔레그램 다리(PR·이슈) end-to-end 검증 완료.
35. 소셜 자동 게시 3채널 — 인스타(캐러셀+릴스+스토리)·유튜브 쇼츠는 하루 2회(오전 `instagram-morning.yml` KST 06~07시 당일경기 legacy / 저녁 `instagram.yml` KST 21시대 내일경기 v2). 카드/릴스/스토리 생성 → `insta-media` orphan 브랜치 푸시(raw CDN) → 게시. 토큰 자동 회전(YT/TikTok refresh + 회전 시 `GH_PAT_SECRETS_WRITE`로 Secret 갱신). **틱톡은 2026-06-25 Direct Post audit 승인 후 활성화**(privacy=`PUBLIC_TO_EVERYONE`, `post:tiktok`). 텔레그램 성공/실패 알림.
36. 틱톡 도달 개선 (2026-06-29) — @hanhaeseol 0조회수(게시는 정상, 배포 억제) 대응. **틱톡 한정**: ①해시태그 스포츠 발견태그(`post-tiktok.ts`) ②틱톡은 **저녁 1회만**(아침 워크플로우에서 제외 — 도배 신호 완화) ③틱톡 전용 릴스 변형 `HHS_TIKTOK_VARIANT=1 npm run reel:make:v2`→`reel-v2-tiktok.mp4`로 title/outro/CTA `haeseol.com` URL→한글("한해설"/"한해설 검색") 교체(워터마크 제거+유튜브판과 차별=중복 회피), `manifest.reelTiktok` 우선 사용. IG/YT 경로(reel-v2.mp4/manifest.reel)는 옵션 noUrl 기본 false라 무변경. AI 실사컷→비-AI(레버3)는 보류. 남은 건 계정 warmup(사람 몫).
37. 라이브 스코어 무새로고침 갱신 (2026-06-29) — kicktalk.xyz(한국어 월드컵 컴패니언) 벤치마크 후 "살아있는 느낌" 도입. **`/api/live`**(동적 함수, `crawlLiveResults` 경량 병렬크롤=진행중·종료만, `s-maxage=30` 엣지캐시) + 클라(`ScheduleClient`) 폴링: 진행중(킥오프~예상종료+여유) 경기 있고 탭 보일 때만 45초 간격 fetch→빌드 results 위에 byKey 머지. 라이브 없으면 폴링 자체 중단. 비용 $0(캐시로 원본부하 상수화). **스케줄러(GH 30분 크롤)는 그대로 필요** — 정적HTML·SEO·영구아카이브·폴백 담당이고 `/api/live`는 그 위 휘발성 오버레이(둘은 보완관계, 대체 아님). `naverGet`에 8초 타임아웃 추가(hang 방지).
38-1. PWA 앱 설치 (2026-06-29) — 홈 화면 설치형 앱. `src/app/manifest.ts`(자동생성 `/manifest.webmanifest`, display=standalone, 색 `#0a0a0a`), `public/sw.js`(install/activate/fetch=설치조건+오프라인 폴백 `/offline`), `ServiceWorkerRegister`. **설치배너 `InstallPrompt`**=핵심설계: `beforeinstallprompt` 이벤트 의존 X(이미설치/막지운직후 이벤트 안와 배너 영영 안뜨는 문제) → **standalone 아니면(=설치안됨) 무조건 노출**. 이벤트 있으면 [설치]버튼(안드/PC 원클릭), 없으면 플랫폼별 수동안내(아이폰=공유→홈추가, 안드=메뉴⋮, PC=주소창아이콘). 닫기=sessionStorage(탭당). 문구=친근·혜택톤 기기별(설치버튼/아이폰사파리/아이폰기타/안드수동/PC). 글래스=`.liquid-glass`(완전투명 backdrop-blur). **설치형 전용**: `PullToRefresh`(맨위 당겨서 reload — 배민식 공/햅틱/콘텐츠밀어내림 시도했다 사용자 선호로 **원래 심플 인디케이터(화살표→스피너)로 복원**), `FocusRefresh`(5분이상 떠났다 복귀시 reload). **새로고침 시 인트로/ripple 스킵**: PullToRefresh가 reload 전 `sessionStorage hhs-skip-intro-once` 세팅 → head 인라인스크립트가 React보다 먼저 읽어 `html.skip-intro` 달고 CSS로 인트로 오버레이 첫페인트부터 display:none(IntroAnimation도 effect서 스킵). **흰 번쩍(검정→흰번쩍→인트로) 대응**(WebKit 재현으로 진단=HTML 로드前 웹뷰 기본 흰캔버스): ①폰트 FOUT 제거(인트로 타이틀 Pretendard→Geist, CDN Pretendard 전면제거) ②`PageTransition` pageEnter 첫로드 미적용 ③html/body/인트로 인라인 검정 ④**`sw.js` v2 SWR**(루트"/" 캐시 즉시반환+백그라운드갱신, SW갱신=닫았다열기 2~3회 후 효과) ⑤`color-scheme:dark`+meta ⑥`public/splash/` 아이폰11종 **단색 검정** 스플래시(로고 넣으니 2번보여 제거). 잔여 깜빡은 iOS 런치스크린→웹뷰 핸드오프(OS레벨, 웹제어 불가). 앱아이콘=로고 75%축소. 비용 $0. **iOS는 매니페스트/스플래시/아이콘·SW가 설치·갱신시점 캐싱→재설치 또는 닫았다열기 반복해야 반영.** 상세 [[project_live_lineup_features]].
38. 선발 라인업 표시 (2026-06-29) — 매치페이지에 라인업. **축구**=`/api/lineup`(네이버 `/lineup`, 포메이션+선발XI, 원정 미러링 보정으로 GK-first 통일), **야구(KBO·MLB)**=`/api/lineup-baseball`(네이버 `/preview`, KBO `fullLineUp`·MLB `batter/pitcher` 구조 달라 파서 각각→타순1~9+선발투수 공통정규화). 둘 다 클라 아일랜드 fetch(페이지 열 때 최신, 초단위 틱 X — 라인업은 경기전 확정), 데이터 없으면 섹션 숨김. `MatchResult.gameId` 추가(크롤서 수집)로 매치↔네이버 연결. 농구·배구는 미지원. 선수평점은 네이버에 없어 제외(Sofascore/Fotmob 별도소스 필요). 비용 $0.
39. 토픽 화~금 완전 자동발행 (2026-06-30) — 작업33의 검수 머지 게이트 제거(사용자 요청). `.github/workflows/auto-publish-draft.yml`: draft/* PR → `npm run build` 통과 → `gh pr ready`(루틴이 GitHub Draft로 PR 열어 머지거부 → ready 전환 필수) → squash 자동머지 → Vercel 배포. 텔레그램 성공/빌드실패 알림. 빌드게이트로 잘못된 초안이 배포(시간별 크롤 포함) 얼리는 것 방지. `notify-draft-pr.yml` 제거(대체). PR #6로 end-to-end 검증.
   - **🔴 2026-07-01 수정(작업43): `opened` 트리거가 무인 실행에서 안 먹었음.** 루틴(자동화)이 연 PR의 `pull_request:opened` 이벤트는 다른 워크플로를 트리거 못 함(GitHub 사양). 6/29 PR #6 "성공"은 그때 수동/synchronize로 돌린 거라 무인 경로가 실제 검증된 적 없었고, 7/1 첫 무인 실행(PR #7)에서 자동발행이 트리거조차 안 돼 DRAFT로 방치됨. → **`schedule` 폴링(화~금 06:40·07:10 KST) + workflow_dispatch**로 전환, 열린 `draft/*` PR 전부를 빌드게이트→ready→머지 처리. **발행 시 `content-plan.md` 큐 줄을 `[x]` 자동 처리**(중복 주제 재작성 방지 — PR #7이 이미 발행된 글 중복이었음). `pull_request` 트리거는 사람이 손댈 때용 보조로 유지.
40. 승부차기 표시 (2026-06-30) — 정규+연장 무승부 PK 경기(예: 독일 1-1 파라과이, PK 3-4)가 "1-1"로만 보이던 문제. `MatchResult.{winner,homePtScore,awayPtScore}` 추가, 네이버 detail에서 수집(목록 winner + 상세 hasPtScore/homePtScore/awayPtScore, 0-0 후 PK도 잡도록 동점+승자존재면 detail 조회). 카드·매치페이지·대진표에 "승부차기 H-A" + 승자 강조.
41. 월드컵 토너먼트 탭 (2026-06-30) — 조별리그 종료 대응. `/worldcup`에 [토너먼트]/[조별 순위] 탭(`WorldcupTabs`, 둘 다 DOM 렌더=SEO유지, 기본=토너먼트). 대진표(`TournamentBracket`)=별도 API 없이 `worldcup.json` 라운드 편성+결과 조립(32강~결승, 미정 경기 표시). 월드컵 배너 텍스트 "조별 순위"→"토너먼트".
42. 라이브 오버레이 득점자 소실 버그 수정 (2026-07-01) — 종료 경기 점수는 뜨는데 득점자가 사라지던 문제. 원인: `crawlLiveResults`가 종료(비-PK) 축구 경기를 골 없이 byKey에 담고, 클라(`ScheduleClient`) 머지가 `{...build, ...live}`로 **키 단위 통째 덮어쓰기**를 해 빌드 데이터의 goals를 지움(라이브 폴링 도는 동안만 발생=헷갈림). 수정: ①`crawlLiveResults`가 골 있는 축구 경기는 **종료 경기도** 상세 조회 ②클라 머지를 **키 단위 필드 병합**(라이브에 없는 골·승부차기 필드는 빌드 값 보존). 데이터는 정상이었고 표시 로직 문제였음.
43. 토픽 자동발행 트리거 수정 (2026-07-01) — 작업39 참조(schedule 폴링 전환 + 큐 [x] 자동). 6:35 "클로드 알림"은 claude.ai 루틴 자체 완료 알림이라 레포로 못 끔(claude.ai 루틴 설정에서 꺼야 함).
44. 성능·접근성·버그 개선 배치 (2026-07-01) — 코드 감사 후 안전·고가치 항목 처리. **성능**: 인트로 엠블럼 PNG→WebP(298→117KB, preload 메인 한정), `/api/live` 상세 pLimit 병렬화, 홈 teamRecords를 표시 리그로 prune, 크롤러 매핑 중복제거+병렬화(`mapGameToResult`/`fillDetails`, crawlAll·Live 공용 — `crawl:results` 실측 검증). **버그**: `getTodayString`/`getUpcomingDates` KST 고정(서버UTC↔클라KST 어긋나 기본날짜 오선택+hydration mismatch 나던 것), emblem·standings naverGet 8초 타임아웃, 크롤 워크플로 push 재시도+crawl.yml concurrency. **접근성/UX**: 핀치줌 차단 해제(maximumScale 제거), 전역 :focus-visible 포커스링 복원, 안내모달 role/aria/Escape, archive 로드실패 에러상태+재시도, 검색 aria-label, 터치타겟·색대비 상향. **의도적 미실행(이득<위험)**: A3(match 번들, 저트래픽·배포트레이스 위험) · A6(쿠팡 JSON 지연) · C3(크롤러 fetch헬퍼/SPORT_MAP 통합, 순수 코드정리). **남은 유일 고가치 = D8 매치별 동적 OG 이미지**(공유 CTR↑=유입 병목에 직접 작용, 위험 낮음·작업량 L).

### 다음 작업 (예정)
- **(내일 먼저 확인) PWA 흰 번쩍** — SWR(sw.js v2)+color-scheme 배포됨. 사용자가 앱 **완전히 닫았다 열기 2~3회**(SW 갱신·"/"캐시 후 효과) 한 뒤 깜빡 사라졌는지 확인. 남으면 iOS 런치스크린 핸드오프(OS레벨)라 웹으론 한계 — 인트로를 더 빨리/다르게 등 우회 검토.
- **경기 찜 푸시 알림** — 사용자 명확 요구: "⭐찜한 경기 득점 시 폰 꺼져있어도(화면off/앱닫힘) 알림"(카톡처럼). **저장소 Upstash→Vercel Blob로 변경**(별도 가입 최소화). **A단계 코드 작성됨**: `src/lib/push/store.ts`(Blob access:private, 구독1건=파일1건), `send.ts`(web-push VAPID), `/api/push/subscribe`·`/test`, `PushSubscribeButton`(푸터, VAPID 미설정시 자동숨김=현재상태). 레포 public이라 GH Actions 골 폴러 $0. **선행(사용자 셋업, 미완): ①`npx web-push generate-vapid-keys` ②Vercel 대시보드 Blob 스토어 생성(BLOB_READ_WRITE_TOKEN 자동주입) ③Vercel 시크릿 4개(NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT/PUSH_TEST_KEY).** 셋업 후 남은빌드 B(⭐찜UI=경기카드 별버튼+follows 저장)→C(시작·결과 발송 GH Actions)→D(실시간 골폴러, 득점후 30~60초·완전실시간은 무료론 불가). 플랫폼: 아이폰=설치필수, 안드/PC=설치없이 🔔버튼만. 상세 [[project_live_lineup_features]].
- **(내일 이어서) 하이라이트 유튜브 연결** — 코드 완료·배포(작업과정은 [[project_highlights]]). **막힘=사용자 셋업 1건**: GCP YouTube Data API v3 활성화 → API key → GitHub repo Secret `YOUTUBE_API_KEY`(무료, Vercel 불필요). 넣으면 다음 시간별 크롤부터 종료 축구경기에 자동 채워짐. 후속(내가): 채워지는지 확인 + 오매칭 시 `youtube.ts` PREFERRED_CHANNELS에 FIFA·JTBC channelId 보강.
- **동적 OG 이미지(D8, 미착수)** — 매치 페이지 공유/검색 시 팀명·스코어·플랫폼·한국어해설 카드 OG 생성(`opengraph-image.tsx`+ImageResponse). 남은 개선거리 중 **유일하게 트래픽(병목)에 직접 작용**(공유 CTR↑), 위험 낮음·작업량 L. 2026-07-01 코드감사에서 "할 만한 유일한 것"으로 결론. (A1 순위 payload는 순위 페이지 개선 원할 때만 — 순위 JSON을 public에 둬야 lazy 가능)
- kicktalk 추가 후보(우선순위): 승부예측+포인트(localStorage 시작=셋업0) > PWA > 팀/국가 상세(SEO) > MVP투표 > 경기별 댓글(가벼운 UGC). 자유게시판 풀버전은 모더레이션 부담으로 제외. (하이라이트는 위 별도 항목으로 진행 중)
- (상시 운영) 매주 월 글감 이슈 도착 → 5개 선택해 큐 세팅. 월요일 1편은 즉시 수동 발행, 화~금 4편은 **완전 자동(머지 불필요, 작업39)**. 월드컵 결과글(16강 7/3·8강 7/9·4강 7/14·3·4위전 7/16·결승 7/17)은 그날 사람이 결과 반영해 수동(해당일은 자동 휴무일)
- 틱톡 0조회수 — 도달 개선 적용(작업 36) 후 조회수 추이 관찰. 안 풀리면 레버3(AI컷 교체)·inbox 수동게시 실험. 계정 warmup은 사람 몫
- (운영 메모) 핵심 미해결은 기술 아닌 **트래픽/수익화** — AdSense·애드핏 다 트래픽 미달이 병목(일 ~110명)

## 개발 명령어

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버
npm run lint     # ESLint 검사
npm run crawl    # 크롤링 실행 (7일치)
npm run crawl:worldcup   # 월드컵 편성+조별순위 재크롤 (현재 기준 맞출 때)
npm run crawl:results    # 결과·스코어 재크롤
```

## 배포

- **Vercel Git 연동**으로 `main` 푸시 시 자동 프로덕션 배포(`vercel.json` 존재, 별도 deploy 워크플로 없음). 가이드 등 콘텐츠 발행 = main 직접 푸시.
- 데이터 JSON의 `lastUpdated`는 **UTC(Z)** 표기(KST=+9). 로컬 "현재 기준"은 위 crawl 명령으로 재크롤(src/data·public 양쪽 기록).
