# 한해설 (HanHaesul) - 스포츠 중계 편성표 서비스

> 작업 원칙(속단 금지 프로세스)·세션 종료 자동정리는 전역 `~/.claude/CLAUDE.md`로 이관됨. 아래는 이 프로젝트 고유 정보만.

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
33. 평일 자동 초안 파이프라인 — 클라우드 루틴(claude.ai routine `trig_01BDiRqeDKktbJ8WhrbUqrKM`)이 `docs/content-plan.md` 큐 + `docs/guide-style.md` 톤으로 초안 작성 → `draft/*` PR. **2026-06-29 ON. cron `30 21 * * 1-4`=화~금 6:30 KST**(월요일 제외 — 월은 글감 받아 사람+클로드가 1편 즉시 발행=수동, 화~금 4편 자동 = 주 5편). 매 실행 step0에서 content-plan.md "자동 휴무일"이면 스킵. **2026-07-15: 섹션명 `★ 월드컵 우선` → `★ 메인 큐`로 일반화**(월드컵 종료 7/20 후 루틴이 고를 섹션이 사라지는 문제 선제거, "월드컵 이후"→"예비"로 개칭). 루틴은 `★ 메인 큐`만 선택하고 "라운드 편성글"·"예비" 섹션은 안 건드림. 큐 줄 끝 시의성 메모("지났으면 건너뛸 것")면 스킵. **루틴 프롬프트에 섹션명이 하드코딩돼 있으니 content-plan.md 섹션명 바꾸면 `RemoteTrigger` update로 프롬프트도 같이 고쳐야 함.**
   - **무성 실패 대비(7/15 추가):** 7/15 아침 루틴이 정상 발화(`last_fired_at` 확인)했는데 PR 없이 빈손 종료. 로그가 안 남아 원인 불명 → 프롬프트에 **"초안 없이 끝내면 이유를 반드시 한 줄 출력"** + "팩트 확인 안 돼도 포기 말고 '확인 필요' 표기로 완성" 규칙 추가. 수동 재실행(`RemoteTrigger` action:run) 하니 정상 PR 생성 → 일회성 실패였음. **레포/워크플로가 멀쩡한데 초안이 없으면 `RemoteTrigger` action:list 로 `last_fired_at` 부터 확인할 것.**
34. 주간 글감 제안 루틴 (2026-06-25, 7-15 갱신) — 클라우드 루틴 2번째(`trig_01M1GZxhpUmur3nkQv6nkj5R`, 매주 월 6:30 KST)가 글감 10개를 `[글감]` 이슈로 생성 → `.github/workflows/notify-ideas.yml`(issues 다리)가 텔레그램. 사람이 5개 골라 큐 세팅(목표 주 5개 발행). 결과/대진글(한국전 결과 등)은 자동 아닌 사람 수동. 두 텔레그램 다리(PR·이슈) end-to-end 검증 완료. **7/15: 이 루틴도 `★ 메인 큐` 섹션명으로 동기화**(작업33 참조). 그리고 **이 루틴이 내는 글감은 시의성 검증이 필요함** — 7/12 이슈 #16이 "MLB 올스타전 어디서 보나"(7/14 종료)와 "4강 2연전"(라운드글과 중복 + 프랑스vs스페인은 발행일 새벽에 이미 끝남)을 냈음. 프롬프트에 "이번 주 안에 끝나버리는 이벤트 금지"·"월드컵 라운드는 worldcup.json 교차확인" 추가했지만 **큐에 넣기 전 사람/세션이 날짜를 다시 확인할 것.**
35. 소셜 자동 게시 3채널 — 인스타(캐러셀+릴스+스토리)·유튜브 쇼츠는 하루 2회(오전 `instagram-morning.yml` KST 06~07시 당일경기 legacy / 저녁 `instagram.yml` KST 21시대 내일경기 v2). 카드/릴스/스토리 생성 → `insta-media` orphan 브랜치 푸시(raw CDN) → 게시. 토큰 자동 회전(YT/TikTok refresh + 회전 시 `GH_PAT_SECRETS_WRITE`로 Secret 갱신). **틱톡은 2026-06-25 Direct Post audit 승인 후 활성화**(privacy=`PUBLIC_TO_EVERYONE`, `post:tiktok`). 텔레그램 성공/실패 알림.
36. 틱톡 도달 개선 (2026-06-29) — @hanhaeseol 0조회수(게시는 정상, 배포 억제) 대응. **틱톡 한정**: ①해시태그 스포츠 발견태그(`post-tiktok.ts`) ②틱톡은 **저녁 1회만**(아침 워크플로우에서 제외 — 도배 신호 완화) ③틱톡 전용 릴스 변형 `HHS_TIKTOK_VARIANT=1 npm run reel:make:v2`→`reel-v2-tiktok.mp4`로 title/outro/CTA `haeseol.com` URL→한글("한해설"/"한해설 검색") 교체(워터마크 제거+유튜브판과 차별=중복 회피), `manifest.reelTiktok` 우선 사용. IG/YT 경로(reel-v2.mp4/manifest.reel)는 옵션 noUrl 기본 false라 무변경. AI 실사컷→비-AI(레버3)는 보류. 남은 건 계정 warmup(사람 몫).
37. 라이브 스코어 무새로고침 갱신 (2026-06-29) — kicktalk.xyz(한국어 월드컵 컴패니언) 벤치마크 후 "살아있는 느낌" 도입. **`/api/live`**(동적 함수, `crawlLiveResults` 경량 병렬크롤=진행중·종료만, `s-maxage=30` 엣지캐시) + 클라(`ScheduleClient`) 폴링: 진행중(킥오프~예상종료+여유) 경기 있고 탭 보일 때만 45초 간격 fetch→빌드 results 위에 byKey 머지. 라이브 없으면 폴링 자체 중단. 비용 $0(캐시로 원본부하 상수화). **스케줄러(GH 30분 크롤)는 그대로 필요** — 정적HTML·SEO·영구아카이브·폴백 담당이고 `/api/live`는 그 위 휘발성 오버레이(둘은 보완관계, 대체 아님). `naverGet`에 8초 타임아웃 추가(hang 방지).
38-1. PWA 앱 설치 (2026-06-29) — 홈 화면 설치형 앱. `src/app/manifest.ts`(자동생성 `/manifest.webmanifest`, display=standalone, 색 `#0a0a0a`), `public/sw.js`(install/activate/fetch=설치조건+오프라인 폴백 `/offline`), `ServiceWorkerRegister`. **설치배너 `InstallPrompt`**=핵심설계: `beforeinstallprompt` 이벤트 의존 X(이미설치/막지운직후 이벤트 안와 배너 영영 안뜨는 문제) → **standalone 아니면(=설치안됨) 무조건 노출**. 이벤트 있으면 [설치]버튼(안드/PC 원클릭), 없으면 플랫폼별 수동안내(아이폰=공유→홈추가, 안드=메뉴⋮, PC=주소창아이콘). 닫기=sessionStorage(탭당). 문구=친근·혜택톤 기기별(설치버튼/아이폰사파리/아이폰기타/안드수동/PC). 글래스=`.liquid-glass`(완전투명 backdrop-blur). **설치형 전용**: `PullToRefresh`(맨위 당겨서 reload — 배민식 공/햅틱/콘텐츠밀어내림 시도했다 사용자 선호로 **원래 심플 인디케이터(화살표→스피너)로 복원**), `FocusRefresh`(5분이상 떠났다 복귀시 reload). **새로고침 시 인트로/ripple 스킵**: PullToRefresh가 reload 전 `sessionStorage hhs-skip-intro-once` 세팅 → head 인라인스크립트가 React보다 먼저 읽어 `html.skip-intro` 달고 CSS로 인트로 오버레이 첫페인트부터 display:none(IntroAnimation도 effect서 스킵). **흰 번쩍(검정→흰번쩍→인트로) 대응**(WebKit 재현으로 진단=HTML 로드前 웹뷰 기본 흰캔버스): ①폰트 FOUT 제거(인트로 타이틀 Pretendard→Geist, CDN Pretendard 전면제거) ②`PageTransition` pageEnter 첫로드 미적용 ③html/body/인트로 인라인 검정 ④~~`sw.js` v2 SWR(루트"/" 캐시 즉시반환)~~ **→ 2026-07-15 폐기(작업51). 재도입 금지** ⑤`color-scheme:dark`+meta ⑥`public/splash/` 아이폰11종 **단색 검정** 스플래시(로고 넣으니 2번보여 제거). 잔여 깜빡은 iOS 런치스크린→웹뷰 핸드오프(OS레벨, 웹제어 불가). 앱아이콘=로고 75%축소. 비용 $0. **iOS는 매니페스트/스플래시/아이콘·SW가 설치·갱신시점 캐싱→재설치 또는 닫았다열기 반복해야 반영.** 상세 [[project_live_lineup_features]].
38. 선발 라인업 표시 (2026-06-29) — 매치페이지에 라인업. **축구**=`/api/lineup`(네이버 `/lineup`, 포메이션+선발XI, 원정 미러링 보정으로 GK-first 통일), **야구(KBO·MLB)**=`/api/lineup-baseball`(네이버 `/preview`, KBO `fullLineUp`·MLB `batter/pitcher` 구조 달라 파서 각각→타순1~9+선발투수 공통정규화). 둘 다 클라 아일랜드 fetch(페이지 열 때 최신, 초단위 틱 X — 라인업은 경기전 확정), 데이터 없으면 섹션 숨김. `MatchResult.gameId` 추가(크롤서 수집)로 매치↔네이버 연결. 농구·배구는 미지원. 선수평점은 네이버에 없어 제외(Sofascore/Fotmob 별도소스 필요). 비용 $0.
39. 토픽 화~금 완전 자동발행 (2026-06-30) — 작업33의 검수 머지 게이트 제거(사용자 요청). `.github/workflows/auto-publish-draft.yml`: draft/* PR → `npm run build` 통과 → `gh pr ready`(루틴이 GitHub Draft로 PR 열어 머지거부 → ready 전환 필수) → squash 자동머지 → Vercel 배포. 텔레그램 성공/빌드실패 알림. 빌드게이트로 잘못된 초안이 배포(시간별 크롤 포함) 얼리는 것 방지. `notify-draft-pr.yml` 제거(대체). PR #6로 end-to-end 검증.
   - **🔴 2026-07-01 수정(작업43): `opened` 트리거가 무인 실행에서 안 먹었음.** 루틴(자동화)이 연 PR의 `pull_request:opened` 이벤트는 다른 워크플로를 트리거 못 함(GitHub 사양). 6/29 PR #6 "성공"은 그때 수동/synchronize로 돌린 거라 무인 경로가 실제 검증된 적 없었고, 7/1 첫 무인 실행(PR #7)에서 자동발행이 트리거조차 안 돼 DRAFT로 방치됨. → **`schedule` 폴링(화~금 06:40·07:10 KST) + workflow_dispatch**로 전환, 열린 `draft/*` PR 전부를 빌드게이트→ready→머지 처리. **발행 시 `content-plan.md` 큐 줄을 `[x]` 자동 처리**(중복 주제 재작성 방지 — PR #7이 이미 발행된 글 중복이었음). `pull_request` 트리거는 사람이 손댈 때용 보조로 유지.
40. 승부차기 표시 (2026-06-30) — 정규+연장 무승부 PK 경기(예: 독일 1-1 파라과이, PK 3-4)가 "1-1"로만 보이던 문제. `MatchResult.{winner,homePtScore,awayPtScore}` 추가, 네이버 detail에서 수집(목록 winner + 상세 hasPtScore/homePtScore/awayPtScore, 0-0 후 PK도 잡도록 동점+승자존재면 detail 조회). 카드·매치페이지·대진표에 "승부차기 H-A" + 승자 강조.
41. 월드컵 토너먼트 탭 (2026-06-30) — 조별리그 종료 대응. `/worldcup`에 [토너먼트]/[조별 순위] 탭(`WorldcupTabs`, 둘 다 DOM 렌더=SEO유지, 기본=토너먼트). 대진표(`TournamentBracket`)=별도 API 없이 `worldcup.json` 라운드 편성+결과 조립(32강~결승, 미정 경기 표시). 월드컵 배너 텍스트 "조별 순위"→"토너먼트".
42. 라이브 오버레이 득점자 소실 버그 수정 (2026-07-01) — 종료 경기 점수는 뜨는데 득점자가 사라지던 문제. 원인: `crawlLiveResults`가 종료(비-PK) 축구 경기를 골 없이 byKey에 담고, 클라(`ScheduleClient`) 머지가 `{...build, ...live}`로 **키 단위 통째 덮어쓰기**를 해 빌드 데이터의 goals를 지움(라이브 폴링 도는 동안만 발생=헷갈림). 수정: ①`crawlLiveResults`가 골 있는 축구 경기는 **종료 경기도** 상세 조회 ②클라 머지를 **키 단위 필드 병합**(라이브에 없는 골·승부차기 필드는 빌드 값 보존). 데이터는 정상이었고 표시 로직 문제였음.
43. 토픽 자동발행 트리거 수정 (2026-07-01) — 작업39 참조(schedule 폴링 전환 + 큐 [x] 자동). 6:35 "클로드 알림"은 claude.ai 루틴 자체 완료 알림이라 레포로 못 끔(claude.ai 루틴 설정에서 꺼야 함).
45. 월드컵 토너먼트 라운드별 편성글 자동 생성·발행 (2026-07-03) — 그동안 "결과·대진 반영"이라 사람 수동으로 뺐던 라운드글(16강·8강·4강·3·4위전·결승)을 데이터 기반 자동화. **LLM 미사용**, `worldcup.json`으로 사람 톤(guide-style) 템플릿 채움=**표+문장 둘 다**. 순수로직 `src/lib/guides/worldcup-round.ts`(`selectTargetRounds`=발행 창[첫경기 D-2~마지막경기] 열린 라운드 **전부**, 32강 제외 / `buildArticle` / `refreshArticle`=마커 `<!-- wc:data -->` 구간만 갱신·도입/마무리 보존) + 유닛테스트 13개 + 스크립트 `gen:worldcup-round` + 워크플로 `worldcup-round-article.yml`(매일 08:20 KST, 빌드게이트→main 직접커밋→텔레그램). **미정 대진은 "미정 vs 스페인, 상대는 32강 결과로 확정" 식 정직 처리**(팀명 추측 X), 앞 라운드 결과 나오는 대로 표만 자동 갱신. `selectTargetRounds`가 창 열린 라운드를 다 처리하는 이유=단일경기 결승(7/20 04:00)이 3·4위전(7/19)에 밀려 경기 뒤에 뜨던 버그 수정→각 라운드 제 D-2 발행(16강 7/3·8강 7/8·4강 7/13·3·4위전 7/17·결승 7/18). 오늘 16강 첫 발행. **content-plan '일정 고정' 섹션=이제 수동 아닌 자동**, '자동 휴무일'을 실제 라운드글 화~금 발행일(7/8·7/17)에 재정렬(에버그린 루틴과 이중발행/빈날 방지). 상세 [[project_content_engine]].
44. 성능·접근성·버그 개선 배치 (2026-07-01) — 코드 감사 후 안전·고가치 항목 처리. **성능**: 인트로 엠블럼 PNG→WebP(298→117KB, preload 메인 한정), `/api/live` 상세 pLimit 병렬화, 홈 teamRecords를 표시 리그로 prune, 크롤러 매핑 중복제거+병렬화(`mapGameToResult`/`fillDetails`, crawlAll·Live 공용 — `crawl:results` 실측 검증). **버그**: `getTodayString`/`getUpcomingDates` KST 고정(서버UTC↔클라KST 어긋나 기본날짜 오선택+hydration mismatch 나던 것), emblem·standings naverGet 8초 타임아웃, 크롤 워크플로 push 재시도+crawl.yml concurrency. **접근성/UX**: 핀치줌 차단 해제(maximumScale 제거), 전역 :focus-visible 포커스링 복원, 안내모달 role/aria/Escape, archive 로드실패 에러상태+재시도, 검색 aria-label, 터치타겟·색대비 상향. **의도적 미실행(이득<위험)**: A3(match 번들, 저트래픽·배포트레이스 위험) · A6(쿠팡 JSON 지연) · C3(크롤러 fetch헬퍼/SPORT_MAP 통합, 순수 코드정리). **남은 유일 고가치 = D8 매치별 동적 OG 이미지**(공유 CTR↑=유입 병목에 직접 작용, 위험 낮음·작업량 L).

46. 매치 동적 OG + SEO 마감 (2026-07-04) — **매치별 동적 OG 이미지**(작업목록 D8 완료): `src/app/match/[slug]/opengraph-image.tsx`(next/og). 팀명·리그·일시·플랫폼 + 한국어/현지 해설 뱃지 카드로 og-default 고정 대체 → 공유 CTR. **폰트/로고는 public에서 HTTPS fetch**(fs+outputFileTracingIncludes는 Vercel 서버리스 번들에 파일 누락으로 500 나서 폐기), satori는 `radial-gradient(circle at ...)` 문법만 됨. match generateMetadata의 정적 og-default images 제거 → 파일 컨벤션이 og:image 주입. **주의: next/og OG는 이 Windows+Node24 로컬에서 렌더 불가(@vercel/og 기본폰트 경로 버그) → 배포 후 라이브로 검증**([[vercel-og-live-verify]]). 부수: `league/[slug]`·`platform/[slug]`에 BreadcrumbList 추가(공용 `buildBreadcrumbLd`). **guide-style.md 휴머나이저 심화 규칙**(글마다 찍어낸 틀 반복 제거 — 구조/오프너/클로저 변주, 출고 전 셀프체크) → 향후 자동초안 반영([[topic-humanizer-followup]]). 커밋 c0e4ff5·ada9e19·ac99bb8.

47. 주간 글감 루틴 뉴스화 + 고정 발행일 + 휴머나이저 표준 (2026-07-06) — **①주간 글감 루틴 전면 개편**(claude.ai `trig_01M1GZxhpUmur3nkQv6nkj5R`): 기존 "밍밍한 에버그린"이 클릭 안 돼서 **뉴스 역산** 방식으로 전환(WebSearch 도구 추가, 매주 이적·빅매치·중계권·코리안리거 뉴스 검색→"언제/어디서/한국어해설/무료" 앵글). 월드컵 끝나도 영구 원칙. 이슈 = 📅예정 발행일정(날짜순) + 💡글감10(🔴만, 근거텍스트 없음). **②고정 발행일 메커니즘**: content-plan.md 큐 줄에 `(고정: YYYY-MM-DD)` → 평일 자동초안 루틴(`trig_01BDiRqe`)이 오늘 고정 항목을 섹션·순서 무관 최우선 작성, 없으면 순차. 고정은 안 밀리고 순차 글이 밀림. 주간 루프=월 이슈→사용자가 며칠 고정/뒤로 지정→내가 content-plan 편집. **③발행글 표준**: 전부 `humanizer` 스킬 통과 + 블로그형 + 900~1400자(guide-style.md 분량 상향). 내 세션 직접 발행글은 스킬 실제 로드. **주의: 루틴이 대진 라운드 라벨 틀릴 수 있음**(포르투갈vs스페인을 8강이라 했으나 실제 16강 — worldcup.json으로 재확인). 첫 발행: `/guide/worldcup-r16-portugal-spain`(7/7 16강). 상세 [[project-content-engine]]·[[feedback-guide-writing]].

48. 하이라이트 유튜브 자동연결 가동 (2026-07-07) — `YOUTUBE_API_KEY` 등록으로 파이프라인 실가동. **리그→공식채널 고정 매핑**(`src/lib/highlights/youtube.ts`): KBO→TVING SPORTS `UC8JtQf77wqhVpOQ8Cze8JjA` / 월드컵→JTBC Sports `UCTdZyOFVzontd9MZOJDg8Qw` / MLB→SPOTV `UCtm_QoN2SIxwCE-59shX7Qg`. 대상 축구 전체+KBO+MLB. **오매칭 방지 규칙(실측 기반, 완화 금지)**: ①채널 스코프+두 팀 모두 제목 언급(한 팀만 요구 시 2019 핸드볼이 잡힘) ②`publishedAfter`=경기일-1일 ③SPOTV 제목 `(MM.DD)`=KST 경기일 필수 일치(MLB 연전 전날 영상 방지) ④첫 결과 폴백 금지 — 업로드 전엔 null, 매시 크롤 재시도가 의도된 동작 ⑤런당 검색 25건 캡(쿼터). SPOTV는 주요 경기만 업로드 → 다수 경기 빈 게 정상. 테스트 10건(`npm run test:highlights`). 7/6 경기 수동 검증 5건 반영. **카드 UI 개편 동반**: 플랫폼 뱃지 상단(상태뱃지 왼쪽), 하이라이트는 하단 중앙 흰 버튼(유튜브 로고+2배 폭), 카드 상하 여백 2배. **남은 확인**: KBO(티빙) 첫 실전, 채움율 낮으면 maxResults 5→10. 별건 발견: SPOTV(TV) 행 팀명 축약("미네소타")으로 스코어 자체가 안 붙는 alias 이슈.
49. 성능·CI 소배치 (2026-07-07) — 홈 클라 직렬화 results prune(과거 비월드컵 제거+디버그 배열 비움, HTML 530→504KB, 아카이브 누적 증가 차단), 홈 JSON-LD competitor 제거(performer와 중복), 매치 OG의 schedule-archive(366KB) 정적 import → 못 찾은 과거 경기만 public HTTPS fetch, `auto-publish-draft`·`worldcup-round-article` 워크플로 `fetch-depth: 0→1`(팩 620MB 풀클론 제거).
50. fadeby 전자책 프로모 배너 (2026-07-14) — 자매 프로젝트 fadeby 시집 『현재가 없는 사람들에게』 홍보 배너를 메인 상단(월드컵 배너 자리)에 게시. `src/app/_components/EbookBanner.tsx`: 표지 유화 `public/ebook-banner.jpg`(세로 900×1351)를 배너 전체 full-bleed 배경(`object-cover`, `objectPosition:center 55%`)으로 깔고 좌측 어둠 베일 + **볼드 Pretendard 인용구** 오버레이 + 크림 알약 CTA "지금 읽어 보기"(데스크톱 우측 하단 `absolute bottom-6 right-8`, 모바일 하단 인라인). 링크 `https://fadeby.vercel.app` 새 탭. **폰트=Pretendard**: `layout.tsx` localFont로 `public/fonts/Pretendard-{Regular,Bold}.otf` 로드(`--font-pretendard`, `preload:false`+`display:swap` — 배너 한 곳만 써 전 페이지 블로킹/인트로 흰번쩍 무관). **인용구 매일 순환**: `fadeby/generated/ebook/book.json`(정본 119편)에서 **3줄·각 줄 16자 이내**로 추린 **72편**을 `src/data/ebook-quotes.json` 스냅샷 → KST 날짜 인덱스(`floor((now+9h)/86400000) % length`)로 매일 하나. SSR 0번 고정 후 `useEffect` 교체(hydration mismatch 없음, 리빌드 불필요). 시 `\n`은 `whitespace-pre-line` + `line-clamp-3` 안전망. **🔴 필터 핵심 = 줄 수만이 아니라 각 줄 길이 ≤16자**(배너 폭 고정이라 긴 줄이 가로 wrap돼 4줄로 넘치면 CTA 잘림 — 초기 "총 44자" 필터로 깨졌던 것 수정). **메인 슬롯 `ScheduleClient.tsx`의 WorldCupBanner→EbookBanner 대체**(월드컵 배너는 `/worldcup`·WorldCupView엔 유지). **주의: quotes는 book.json 스냅샷 — fadeby 시가 바뀌면 자동 동기화 X, 재추출 필요**(상세 [[project-ebook-banner]]). 커밋 ea93981 외 디자인 반복(1a84efd 등).

51. SW 루트 캐시 폐기 + 홈 정적화 + 인트로 로드 동기화 (2026-07-15) — 사용자 신고 2건("첫 진입에 인트로 없이 배너가 확대돼 나옴", "옛 월드컵 배너가 나오고 새로고침해야 바뀜")이 **한 결함에서 나옴**: 작업38-1의 `sw.js` v2 루트 SWR이 `cached ||`로 캐시본을 무조건 우선 반환 → HTML은 빌드마다 바뀌는 `/_next/static/<buildId>/`를 참조하므로 배포 직후 첫 로드에 ①옛 배너·옛 편성표 ②옛 청크 404 시 CSS/JS 통째 누락 → Tailwind 클래스에 의존하는 인트로(`fixed inset-0`)가 화면을 못 덮고 `next/image fill` 배너가 전면 확대. 7/14 배너 교체가 그 조건이었음. **홈은 매시 크롤로 리빌드돼 HTML 캐시는 항상 stale이 된다.**
    - **`sw.js` v3**: 캐시를 오프라인 폴백 전용으로 환원(HTML 캐시 0), `activate`가 v2 캐시 삭제, 등록에 `updateViaCache:"none"`. **기존 방문자는 옛 SW가 살아있어 다음 접속 1회는 옛 화면 → 그때 v3 교체 → 이후 정상**(SW 특성, 우회 불가).
    - **흰 번쩍 근본 원인은 따로 있었음**: 홈이 `searchParams`를 서버에서 읽어 App Router 규칙상 **동적 렌더로 강등** → `private, no-cache, no-store` + `X-Vercel-Cache: MISS` = CDN 캐시 완전 꺼짐, 매 요청 함수 실행 → TTFB가 첫 페인트 지연. SWR은 그 증상을 덮으려던 것. **해결 = `searchParams` 제거 + `export const revalidate = 60`**, 딥링크(`?sport=`·`?platform=`·`?comm=`)는 `ScheduleClient`가 마운트 후 `location.search`로 적용(내부 이동 링크 전용·sitemap에 없어 색인 영향 0). `?date=`는 middleware가 301로 떼어내 서버에 도달 못 하던 죽은 코드라 제거. **데이터는 배포 번들 안에 있어 동적 렌더의 신선도 이득은 0이었음.** 검증: `X-Vercel-Cache: HIT`+`Age` 증가, SSR 출력(인트로1·카드91·SportsEvent 100) 유지.
    - **인트로**: 7×3 고정 그리드 시도 → 사용자가 별로라 해서 **3열 티커로 복귀**. 대신 팝인만 제거 — 21개 `decode()` 완료 후 한 번에 페이드인, `animationPlayState`로 준비 전엔 0지점 정지(숨기기만 하면 그 사이 애니메이션이 흘러가 중간부터 시작). 1200ms 상한. 로고는 이미 로컬 WebP 117KB(개당 5.6KB)라 **용량은 병목이 아니었음**.
    - 커밋 `2e0a07d`·`d7c34b7`·`20edc08`·`7beb93a`. 상세 [[project_live_lineup_features]].
52. 🔴 `/api/live`가 하루 종일 옛 스냅샷을 내보내던 버그 (2026-07-15, 커밋 `e2f8d61`) — 끝난 경기(프랑스 0-2 스페인, 04:00 KST)가 11시 넘도록 "후반 2분 0-1 진행중"으로 표시. **데이터는 다 정상이었고 `/api/live`만 틀렸음**: 네이버 원본=`RESULT`/0-2, `results.json`(매시 GH Actions 크롤)=finished 0-2, 배포된 정적 HTML=종료로 정상 렌더. 클라가 `/api/live`를 빌드 데이터 위에 머지하므로 정확한 종료 데이터가 옛 진행중 상태로 덮인 것.
    - **원인**: `naverGet`의 `fetch`에 `cache` 옵션이 없어 **Next.js Data Cache**가 응답을 붙잡음. `dateRange()`의 from/to가 `toYmd`(KST)라 **URL이 KST 하루 내내 고정**(`fromDate=2026-07-14&toDate=2026-07-16`) → 그날 첫 폴링(04:50 KST, 경기 진행중) 응답이 캐시돼 하루 종일 재생. 라우트의 `dynamic="force-dynamic"`은 **라이브러리 내부 fetch까지 막지 못함**. `period`가 `"후반 2'"`(=`g.statusInfo`)인 것도 그 시각 스냅샷과 일치.
    - **피해 양방향**: 끝난 경기가 진행중으로 남는 것 + 그 시점 이후 시작한 경기가 라이브에 아예 안 뜨는 것(수정 후 MLB 올스타전 `live 0-3 6회말`이 새로 나타남). 구조상 **한 번 캐시되면 그날 통째로 얼어붙음**. 매일 그랬는지는 미확인(캐시 축출 편차).
    - **수정**: `naverGet`에 `cache: "no-store"`(핵심). `/api/lineup`·`/api/lineup-baseball`도 같은 부류라 선제 차단(미발표 상태 고정 방지). `/api/emblem`은 immutable 로고라 제외. `src/lib/crawlers/*`는 GH Actions(tsx) 전용이라 Next 캐시 무관.
    - **교훈: Vercel(Next 런타임)에서 도는 fetch는 `cache` 옵션을 반드시 명시할 것.** `force-dynamic`을 믿지 말 것. 신선도는 응답의 `s-maxage`(엣지 캐시)로만 제어.
    - **재발 방지 = 문서가 아니라 가드(커밋 `a89e33a`).** `src/lib/fetch-cache-guard.test.ts`(`npm run test:fetch-cache`)가 **src/app에서 전이적으로 도달 가능한 서버 파일의 GET fetch에 `cache`/`next` 옵션이 없으면 실패**시킴. "use client"·비-GET은 제외, 예외는 fetch 위 5줄 안에 `fetch-cache-ok: <이유>` 주석. **옵션은 호출부에 인라인해야 함**(정적 스캐너라 변수 참조는 못 봄). 스캐너 자체가 깨지는 회귀도 잡음(도달 파일 수·핵심 파일 존재 검증 + 위반 픽스처). 오늘 버그를 되돌려 `fail 1` 나는 것 실증함.
    - **가드가 즉시 더 잡은 것**: `opengraph-image`의 폰트2+로고(→`next.revalidate=86400`. Data Cache는 배포 간 유지라 `force-cache`면 로고 교체가 영구히 안 먹음), `schedule-archive.json`(→`revalidate=3600`), `/api/emblem`(→`no-store`. 라우트가 이미 1년 immutable로 CDN 캐시하니 이미지 바이트 이중 적재 불필요).
    - **CI 신설(`.github/workflows/test.yml`)** — 그동안 **코드 푸시에 도는 CI가 아예 없었음**(Vercel은 빌드만, `auto-publish-draft`의 빌드 게이트는 마크다운 초안 경로 전용). 이제 코드 변경 push/PR에서 `tsc` + 테스트 68건(fetch-cache 2·worldcup-round 13·starters 17·highlights 10·tiktok-caption 5·idea-dupes 11·naver-news 10). 매시 크롤이 `src/data`만 바꾸는 커밋엔 `paths` 필터로 안 걸림.

53. 인스타 저녁 게시 전멸 → Meta 일시 장애 내성 강화 (2026-07-19, 커밋 `8a901981`) — 7/19 저녁 워크플로우에서 캐러셀·릴스·스토리 3종 전부 실패(유튜브·틱톡은 성공). **원인 = 우리 버그 아님**: Meta API 쪽 일시 장애(`code=2, is_transient:true`)가 ~5분 지속됐는데 재시도 예산이 고정 15s×5(~75s)뿐이라 못 버팀. 캐러셀은 컨테이너 5개 다 멀쩡했는데 **상태 조회 호출 자체**가 code=2만 돌려줘 60s 폴링 예산 소진으로 사망. **수정**: ①`postMedia` 재시도 8회+지수 백오프(최대 120s, 총 ~10분 커버) ②`waitForFinished`가 is_transient 조회 실패를 폴링 예산과 별도 카운터(30회×10s)로 대기 ③`publish`도 is_transient 재시도 ④**댓글 실패 비치명화**(게시 완료 후 댓글에서 exit 1 → 재실행 시 중복 게시되는 경로 차단) ⑤워크플로 `instagram_only` 입력 신설(아침·저녁 둘 다) — **부분 실패 시 전체 재실행하면 유튜브·틱톡이 중복 게시되므로 반드시 `gh workflow run instagram.yml -f instagram_only=true`로 인스타만 재실행할 것.** 당일 7/20(결승 전야) 게시분은 이 방법으로 재게시 완료(3종 Media ID 확인).
54. 틱톡 0조회수 대응 — 캡션 스팸 신호 제거 (2026-07-19) — @hanhaeseol 몇 주째 조회수 0. 진단: 업로드·privacy는 정상(`PUBLIC_TO_EVERYONE` 허용목록 확인, 심사 통과 상태) → **틱톡 "비독창적/저품질 → FYP 추천 부적격" 분류가 유력**(정확히 0 = 추천 배포 자체가 안 됨). 코드로 잡을 수 있는 스팸 신호 3종 제거: ①캡션 내 생 URL(클릭 불가+홍보 신호) ②해시태그 13개 도배(#fyp #추천 포함) ③매일 동일 템플릿 문장. **새 `src/lib/tiktok-caption.ts`**: IG 캡션 재사용 중단, 첫 줄 후킹 5종 날짜 순환(viral-hooks 원칙) + 매치 라인 + CTA "'한해설' 검색"(URL 없음) + 매치 기반 태그 5개만. `is_aigc: true`는 유지(미표기 적발 시 -73% 도달 페널티가 더 큼, 선제 라벨은 페널티 없음 — 조사 결과). 가드 테스트 `test:tiktok-caption` 5건(URL 금지·태그 ≤8·도배 태그 금지) CI 편입. **코드로 안 되는 남은 것(사람 몫)**: 앱에서 설정→계정 상태 + 영상별 "추천 부적격" 표시 확인 → 있으면 이의신청, 계정 warmup(실사용). 다음 코드 레버 = 영상 독창성(보이스오버/TTS, AI컷→실사) — 캡션 개선 후 1~2주 추이 보고 판단.

55. 글감 파이프라인 뉴스화 + 중복 가드 (2026-07-20) — 주간 글감 루틴의 두 결함을 코드로 막음. **①글감 근거를 네이버 뉴스 API로 교체**: 루틴이 WebSearch로 글감을 뽑아 발행일을 모른 채 이미 끝난 이벤트를 냄(7/12 이슈 #16 = 끝난 MLB 올스타전). `src/lib/news/naver-news.ts` + `gen-news-digest.ts` → `docs/news-digest.md`, 워크플로 `news-digest.yml`(매일 06:00 KST, 월요일 루틴 06:30 직전). 엔드포인트 `https://naverapihub.apigw.ntruss.com/search/v1/news`(NAVER Cloud **API HUB** — 구 developers.naver.com/openapi.naver.com 아님), 헤더 `X-NCP-APIGW-API-KEY-ID`/`X-NCP-APIGW-API-KEY`, 시크릿 `NAVER_API_KEY_ID`/`NAVER_API_KEY`, 무료 25,000건/일. **점수 규칙이 핵심**: 가점만 두면 `중계권`·`티빙` 단어를 가진 **미디어 산업 기사**(중앙일보 도산·KBS 적자·CJ ENM 실적)가 상위권을 다 먹음 — 실측으로 확인 후 스포츠 신호 필수 + 산업/연예 기사 배제 + **키워드당 상위 2건 제한**(같은 사건 매체별 3연속 방지) 추가. 키워드도 "스포츠 중계권" 같은 산업어 → "쿠팡플레이 축구"·"KBO 후반기" 같은 팬 대상어로 교체. **②이슈 중복 자동 검사**: 루틴이 content-plan.md도 guides도 안 읽어 이미 큐에 있는 주제를 재제안(7/19 이슈 #20에서 3건). `src/lib/guides/idea-dupes.ts` + `notify-ideas.yml`이 이슈 코멘트 + 텔레그램에 경고(게이트 아님, 경고만). **한국어 조사는 접두 매칭으로 처리 — 조사를 떼면 `쇼헤이`→`쇼헤`, `쿠팡플레이`→`쿠팡플레`로 고유명사가 깎임(실제로 겪고 폐기).** slug 토큰은 제목보다 2배 가중(주제 키라서). **③루틴 프롬프트 교체**(`trig_01M1GZxh`): 다이제스트 우선 + 이슈에 **추천 5개를 발행일까지 붙여** 내도록 → 사람은 승인만. 테스트 21건(idea-dupes 11·naver-news 10) CI 편입. **발행 편수는 그대로 주 5편** — 20편 발행에 일 110명이라 병목이 편수가 아니라 편당 유입이고, GSC로 편당 유입을 본 적이 없어 늘릴 근거가 없음.

56. 문체 린터 + 발행 게이트 (2026-07-20) — 사용자가 "글이 AI 같다"고 지적. `docs/guide-style.md`에 규칙이 58줄이나 있었는데도 초안이 **규칙을 형식으로만 충족**하고 있었음: "리듬 섞어라" → `이번엔 달라요.` 한 줄 문단을 기계 삽입, "표 1개 권장" → 모든 글에 9행 명세표 정확히 하나, "의견 넣어라" → `기대되는 게 사실이에요`(감정의 주어 없음). **부탁 대신 검사로 막음.** `src/lib/guides/style-lint.ts`(`npm run lint:guides`) — 줄표·굽은따옴표·이모지 소제목·라벨 소제목(`### 시청 조건`)·정형 오프너/클로저·주어 없는 감정·표 2개 이상 = 오류, 문단 길이 균일·종결어미 단조 = 경고. `auto-publish-draft.yml`이 **PR이 추가한 글만 검사해 오류면 머지 거부**(기존 발행글은 미검사). **실측: 발행글 20편 중 9편이 `한해설에서 확인하세요` 변주로 끝나고 있었음** — 묶어 읽으면 기계 티가 나던 정체. `guide-style.md`에 우리 글에서 뽑은 나쁨/좋음 예시 섹션 추가(추상 규칙보다 예시가 먹힘). `.claude/skills/hanhaeseol-writing` 신설 — 로컬 세션이 팩트확인→초안→humanizer 스킬→린터 순서를 밟게. **새 글쓰기 플러그인은 설치 안 함**: 마켓플레이스 5개에 블로그용이 없고, marketing-skills의 copywriting/copy-editing은 전환 카피용이라 블로그에 쓰면 광고글이 됨.

57. 구글 디스커버 + 소셜 실적 확인 (2026-07-20) — 둘 다 "만드는 게 아니라 켜는 것". **①디스커버**: `max-image-preview:large`가 없어 후보에서 아예 빠져 있었음(`layout.tsx` googleBot 지시자 추가). 가이드 20편이 전부 같은 `og-default.png`를 쓰고 있어 **글마다 고유 OG 카드** 생성(`guide/[slug]/opengraph-image.tsx`, match와 같은 HTTPS 에셋 패턴 — fs로 읽으면 서버리스 번들에서 500). **②소셜 실적**(`social-stats.ts` + `social-stats.yml` 주간+수동, 텔레그램): 하루 2회씩 몇 주를 게시하면서 조회수를 한 번도 안 봤었음. **결과: 유튜브 누적 4.8만 조회·최근 15개 중앙값 226·구독자 10명(일 500회 노출 = 사이트 유입의 5배인데 전환 0), 인스타 게시물 150개에 팔로워 3명, 틱톡은 API로 읽기 불가**(우리 토큰 스코프가 `video.publish`/`video.upload`뿐 — 조회수는 `video.list` 재인증 필요). **유튜브에 같은 제목 영상이 매일 2개씩 중복 게시되고 있음**(아침·저녁 세트). **판단: 쇼츠는 외부 링크 클릭이 구조적으로 안 되고 브랜드 검색도 3개월에 2회뿐이라, 소셜을 키워 사이트 유입으로 만드는 경로는 사실상 막혀 있음.**

58. 🔴 GSC 전수 분석 → 팀 페이지 신설 (2026-07-20) — **오늘 제일 큰 발견.** 3개월 GSC: 총 클릭 67(하루 0.7), **구글은 전체 유입의 1%**(GA 일 110명·네이버 78%). **①매치 페이지 1,330개가 노출 0** — 사이트맵 1,396개 중 1,330개가 매치인데 노출이 잡힌 40개 URL에 하나도 없음. 원인 셋: 고아(홈에서 18개·리그에서 5개만 링크), 수명이 하루(경기 끝나면 수요 소멸), 네이버 스포츠와 정면 경쟁. **②가이드 20편도 사실상 0** — 목록에 2편만, 그것도 0클릭. **③실제로 먹는 건 편성표**: `/platform/coupang-play` 26클릭·CTR 19.85%·순위 5.66(쿠팡이 공개 편성표를 안 내놔 생긴 빈자리). `프로야구 순위` 계열은 노출 많지만 40~90위로 네이버에 안 됨 — **버릴 자리**. **④kicktalk.xyz 대조가 가정을 뒤집음**: URL 161개·글 6편으로 애드센스 승인. 우리는 1,396개·20편으로 4차 거절. **양이 문제가 아니라 지배적 페이지 타입의 모양이 문제**(우리 매치 페이지는 같은 문장을 변수만 바꿔 두 번 반복 + `아스날는 시즌 0승 0패`). **4차 거절 후 "사람이 쓴 글을 늘린다"는 처방이 방향을 잘못 잡은 것으로 보임.**
    - **팀 페이지 신설**(`/team/[slug]`, `src/lib/teams.ts`): 매치와 달리 **시즌 내내 수요가 붙는 상시 엔티티**. 85개(KBO 10·MLB 30·MLS 16·K리그 12·K리그2 17). **자격 게이트 2개 — 둘 다 매치 페이지 실패에서 나옴**: ①경기를 치른 팀만(개막 전 유럽 138팀 제외, 전부 0승 0패라 그대로 뽑으면 빈 페이지 138개) ②국내 중계 기록이 있는 팀만(MLS 14팀 제외). **유럽은 개막하면 자동 편입.**
    - 내용: 지표 타일(순위·전적·승률/승점·득실차/게임차), **홈·원정 성적**(순위표엔 없는 값 — 우리 결과로 직접 계산), **플랫폼별 경기 수 막대**(티빙 54·tvN 16… "어디서 보나"의 정량 답), 리그 순위표 ±2위(각 행이 팀 페이지로), 경기는 **메인과 같은 `ScheduleCard`**로 날짜별 그룹. 본문 1,536자(kicktalk 1,171자 상회).
    - **진입 경로**: 매치 페이지 엠블럼 아래 `팀 상세정보` 알약 태그 + 홈 "팀별 중계 일정" 블록. **팀 페이지가 없으면 태그·링크를 아예 안 보여줌**(홈 85링크 전부 실제 페이지 있음을 빌드로 검증). 고아 상태로 태어나지 않게 하는 게 목적.
    - **`src/lib/josa.ts` 신설** — 템플릿에 조사를 고정해 `아스날는`·`선두 서울와`가 나오던 것. 받침 판정으로 고름(영문은 받침 없는 쪽, 숫자는 읽는 소리). 매치 페이지 빌드 결과 186문장 전수 검사 0건 오류.
    - **선수 페이지는 안 만듦(2026-08 이후 재검토)**: 득점자 288명 중 2골 이상이 85명이고 상위가 전부 끝난 월드컵 선수. 정작 검색되는 **손흥민 1골·김민재 1골·이강인 0·이정후 0**이고 야구는 선수 기록 자체가 없음. 지금 만들면 얇은 페이지 288개를 추가하는 셈.
    - 상세 계획은 `docs/growth-plan.md`.

59. 🔴 네이버 서치어드바이저 첫 확인 → 오늘 판단 여럿 뒤집힘 (2026-07-20) — 유입의 78%인 네이버를 처음 열어봤고, **작업58의 전제가 부분적으로 틀렸음이 드러남.**
    - **규모**: 네이버 90일 노출 **366.2만**·클릭 **3,500**·CTR 0.1% / 구글 3개월 노출 837·클릭 67. **네이버 노출이 구글의 4,374배.** 그날 오전 전략을 구글 데이터(전체 노출의 0.02%)로 세웠던 것.
    - **CTR 편차가 핵심**: `sbs 스포츠 야구 해설 일정` 23.6%(407노출) · `프로야구 편성표` 23%(269) · `쿠팡플레이 편성표` 17.8% · `스포티비2 야구 해설` 11.6% ↔ `/standings/kbo` **108.9만 노출에 64클릭(0%)** · `2026 프로야구 순위` 45.7만 노출 39클릭. **"편성표·해설"은 네이버가 답 못 하는 질문이라 우리가 이기고, "순위"는 네이버가 자체 위젯을 최상단에 박아 위치가 구조적으로 밀림**(제목 고쳐도 한계). 순위 페이지는 **삭제가 아니라 추가 투자만 중단**(유지비 0, 노출 108만).
    - **뒤집힌 판단 둘**: ①"해설 클러스터는 노출 20회라 작다"(구글 기준) → 네이버에선 CTR 최상위 ②"매치 페이지는 죽었다"(구글 노출 0) → 네이버에선 매치 한 장이 **41.4만 노출·49클릭**.
    - **대응 1 — `/commentary` 신설**: 7일치 한국어 해설 경기 + 채널별 집계(3,058자). 홈·전역 푸터에서 링크. 플랫폼 10개 `keywords`에 해설 계열 추가(**그전까진 해설 키워드가 하나도 없었음** — 23.6% CTR이 타게팅 없이 잡힌 것).
    - **대응 2 — 색인 게이트 반전(`isRichMatch`)**: 기존 기준이 "인사이트 or 최종 스코어"라 **경기가 끝난 뒤에야 색인**됐는데 검색 수요는 경기 전~당일에 몰림(`2026년 07월 16일 kia 타이거즈 ssg 랜더스` 단일 쿼리 14.7만 노출). **예정 경기(오늘 이후)를 색인 대상으로 추가.** 근거: 그 페이지들 실측 1,090~2,159자로 kicktalk(1,171자)보다 두꺼움. 지난 날짜인데 스코어 없는 것(수집 실패·취소)만 계속 제외. 사이트맵 1,396→**1,514**, prerender 246개 중 noindex 3개.
    - **사이트 진단**: 색인 **880**, 색인제외 **440**(meta robots = 우리 정책), 수집제한 4, SEO 이슈 0. 색인제외가 200→440으로 증가 중이었음 → 위 게이트 반전으로 감소 예상.
    - **다운로드 시간 2배 조사(같은 날 처리)**: 캐시 warm이면 `/league/kbo` TTFB 0.13초로 서버는 빠름. 느린 건 **cold 요청 + 페이지 무게**였음. 그 페이지가 **925KB**였는데, 리그 페이지가 경기가 아니라 **편성 행 단위로 카드를 그려** KBO 30경기가 카드 60장이었음(카드마다 최근5경기 뱃지 20개). 리그 페이지엔 채널 필터가 없어 반복이 무의미했음. 경기 단위로 접고 채널을 한 줄에 합쳐 **925KB → 559KB, 카드 60 → 30**. 여기서도 시각을 키에 넣어 SPOTV(18:15 사전방송)와 티빙(18:30)이 갈리는 함정에 한 번 걸림(팀 페이지와 동일). **7/06 인과는 미증명** — 그 주에 하이라이트 기능·카드 UI 개편이 같이 나갔고 둘 다 카드당 마크업을 늘림.
    - **관측 지표(2~4주 뒤)**: ①색인 수 880 → 증가하는지 ②해설 쿼리 노출 407 → 오르는지 ③`/team/` 노출이 잡히는지.

60. 좌측 쿠팡 사이드 배너 → 채운 프로모 교체 (2026-07-24, 커밋 `b7ef5aaa`) — 메인 XL(≥1280px) **좌측** 쿠팡 aside(상품 2카드)를 자매 프로젝트 **채운**(chaeun.haeseol.com, 사주 오행 배경화면) 세로 배너로 대체. 우측 aside는 쿠팡 유지, 상단 fadeby 배너(작업50)도 유지. `src/app/_components/ChaeunSideBanner.tsx`(124×500), `CoupangBanners.tsx`의 `CoupangSideBanners` 좌측만 교체(우측 `useShuffledProducts(2)`). **🔴 브랜드 요소는 창작 금지, 채운 원본 이식**: 인장 = 채운 `.brand-seal`(`chaeun/app/detail/detail.css`) 그대로 — 주홍 `#b23a2e` 낙관 + 흰 `彩運` 세로 스택 + 흰 안쪽 테두리 + `rotate(-5deg)`. 폰트도 동일 `Noto Serif KR`(`layout.tsx` next/font/google `--font-serif-kr`, preload:false·swap — 배너 전용이라 메인 페인트 영향 0, 실제 로드 검증). **연꽃 = `public/chaeun-flower.jpg`**: 채운 `flower-og.jpg`(1600×1203)를 sharp로 세로 크롭(`extract left545 top120 w520 h1083`) → **확대 절대 금지**(landscape를 세로 박스에 cover하면 가운데만 확대돼 사용자가 싫어함), `object-contain`+위쪽 하늘을 잉크(`#0b0b0c`)로 그라데이션 seamless 연결. CTA "내 기운 보기"(채운 카피 통일)는 연꽃 아래 바위 위. 세로쓰기 태그라인(`vertical-lr` 좌→우) "오행으로 채우는 / 나만의 배경화면". **채운 시가·이미지 바뀌면 스냅샷이라 재크롭 필요.** 상세 [[project-chaeun-banner]].

### 다음 작업 (예정)
- **팀명 alias 미스매치 재점검 (유럽 개막 2026-08~)** — 2026-07-23 LAFC 3-1 솔트레이크 스코어가 안 뜨던 버그(네이버 `솔트 레이크`↔스케줄 `레알 솔트레이크`/`솔트레이크` alias 다리 없음, 마이애미·신시내티도 동일) 수정 후, 오프시즌 리그(EPL·라리가·세리에A·리그1·분데스 등)는 스케줄에 경기가 없어 **오프라인 검증 불가**로 남김. 유효 검증은 스케줄↔결과 실표기 대조뿐(alias 키 vs 결과 primary 비교는 무효 — primary는 매핑 후 값이라 네이버 원본표기 모름). **개막 후 `npm run crawl && npm run crawl:results && npm run audit:aliases` 실행** → `MISS>0` 나오는 리그만 `team-name-aliases.ts`에 네이버 표기 키 보정. 감사 스크립트 = `src/scripts/audit-aliases.ts`.
- 🔴 **네이버 지표 재확인 (2~4주 뒤)** — 2026-07-20 조치들의 효과 판정. searchadvisor.naver.com → 리포트. 볼 것: ①사이트 진단 색인 수(880 기준) ②해설 쿼리 노출(407 기준) ③`/team/`·`/commentary` 노출 발생 여부. **사용자만 뽑을 수 있음(스크린샷이면 충분).**
- **유튜브 중복 게시 정리** — 아침·저녁 세트가 같은 제목 영상을 매일 2개 올림(작업57). 유튜브가 중복을 배포에서 누를 수 있음.
- **팀 페이지 색인 추적(2~3주)** — 2026-07-20 배포. GSC에서 `/team/` 노출이 잡히기 시작하는지. 잡히면 다음 확장(선수 페이지·리그 페이지 재정렬)의 근거가 됨. 안 잡히면 매치 페이지와 같은 실패라 원인 재진단 필요.
- **선수 페이지 (2026-08 이후)** — 지금은 데이터가 없어서 보류(작업58 참조). EPL·분데스 개막(8/22)으로 유럽 팀 페이지가 생기면 코리안리거 허브(이정후→샌프란시스코, 손흥민→LAFC, 이강인→아틀레티코, 김민재→뮌헨)부터 검토.
- **유튜브 중복 게시 정리** — 아침·저녁 세트가 같은 제목 영상을 매일 2개 올림(작업57 실측). 유튜브가 중복을 배포에서 누를 수 있음. 하루 1편으로 줄이거나 제목·내용을 확실히 분리.
- **뉴스잭(작업55 후속, 보류)** — 다이제스트를 30~60분 주기로 돌려 감시 키워드 급증 시 텔레그램 + `draft/*` PR 자동 생성. 인프라(`auto-publish-draft.yml` 빌드게이트)는 이미 있고 트리거만 추가하면 됨. **글감 질 1~2주 관찰 후 판단.**
- **PWA 흰 번쩍 — 근본 원인 해결됨(작업51, 7/15).** 홈이 동적 렌더라 CDN 캐시가 꺼져 있던 게 원인이었고 `revalidate=60` 정적화로 엣지 즉시 서빙. SWR은 폐기(재도입 금지). **남은 확인**: 사용자 폰에서 앱 닫았다 열기 1~2회(옛 SW 교체) 후 번쩍 체감 확인. 그래도 남으면 iOS 런치스크린→웹뷰 핸드오프(OS레벨, 웹 제어 불가).
- **경기 찜 푸시 알림** — 사용자 명확 요구: "⭐찜한 경기 득점 시 폰 꺼져있어도(화면off/앱닫힘) 알림"(카톡처럼). **저장소 Upstash→Vercel Blob로 변경**(별도 가입 최소화). **A단계 코드 작성됨**: `src/lib/push/store.ts`(Blob access:private, 구독1건=파일1건), `send.ts`(web-push VAPID), `/api/push/subscribe`·`/test`, `PushSubscribeButton`(푸터, VAPID 미설정시 자동숨김=현재상태). 레포 public이라 GH Actions 골 폴러 $0. **선행(사용자 셋업, 미완): ①`npx web-push generate-vapid-keys` ②Vercel 대시보드 Blob 스토어 생성(BLOB_READ_WRITE_TOKEN 자동주입) ③Vercel 시크릿 4개(NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT/PUSH_TEST_KEY).** 셋업 후 남은빌드 B(⭐찜UI=경기카드 별버튼+follows 저장)→C(시작·결과 발송 GH Actions)→D(실시간 골폴러, 득점후 30~60초·완전실시간은 무료론 불가). 플랫폼: 아이폰=설치필수, 안드/PC=설치없이 🔔버튼만. 상세 [[project_live_lineup_features]].
- **하이라이트 KBO 첫 실전 확인** — 작업48 가동됨. 저녁 KBO 종료 후 티빙 채널 매핑으로 자동 채워지는지 확인. 채움율 낮으면 maxResults 5→10 완화 검토.
- **수익화 대기 2건**: ①애드핏 신청 — **발행글 20개 조건 2026-07-20 충족**(`src/content/guides/` 20개, 월드컵 라운드글 5편이 채움). 신청은 아직 안 함 — 애드센스 5차도 같은 시기. ②쿠팡파트너스는 사용자가 와우멤버십 링크 가능여부+스포츠 상품 링크 ~20개 주면 `coupang-products.json` 교체+맥락 배치(링크프라이스는 티빙 없어 접음, 재조사 금지 — auto-memory `hhs-monetization-findings`).
- kicktalk 추가 후보(우선순위): 승부예측+포인트(localStorage 시작=셋업0) > ~~PWA~~(완료) > ~~팀 상세~~(완료, 작업58) > MVP투표 > 경기별 댓글(가벼운 UGC). 자유게시판 풀버전은 모더레이션 부담으로 제외. (하이라이트는 위 별도 항목으로 진행 중)
- (상시 운영) 매주 월 글감 이슈 도착 → 5개 선택해 큐 세팅. 월요일 1편은 즉시 수동 발행, 화~금 4편은 **완전 자동(머지 불필요, 작업39)**. 월드컵 라운드 편성글(16강·8강·4강·3·4위전·결승)은 **이제 자동(작업45, `worldcup-round-article.yml`)** — 데이터 기반 편성·일정·중계 정리라 사람 손 안 탐(결과 서사 넣는 전면 재작성만 사람 몫). 단, 한국전 결과 등 특정 경기 결과·감상글은 여전히 사람 수동
- 틱톡 0조회수 — 캡션 스팸 신호 제거(작업54, 7/19) 후 1~2주 추이 관찰. **사용자 확인 필요: 앱에서 설정→계정 상태 + 각 영상 "추천 부적격" 표시 → 있으면 이의신청.** 안 풀리면 다음 레버 = 영상 독창성(TTS 보이스오버, AI컷→실사), inbox 수동게시 실험. 계정 warmup은 사람 몫
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
npm run test:fetch-cache # 🔴 Next 런타임 fetch 캐시 가드 (CI에서도 돎)
npm run test:worldcup-round / test:starters / test:highlights / test:tiktok-caption
npm run test:idea-dupes / test:naver-news
npm run audit:aliases   # 팀명 alias 미스매치 감사 (결과 있는데 스코어 안 뜨는 유형). 개막 후 crawl:results 뒤 실행
npm run news:digest      # 네이버 뉴스 → docs/news-digest.md (NAVER_API_KEY_ID/NAVER_API_KEY 필요)
ISSUE_BODY="$(gh issue view N --json body -q .body)" npm run check:idea-dupes  # 글감 중복 검사
```

## 배포

- **Vercel Git 연동**으로 `main` 푸시 시 자동 프로덕션 배포(`vercel.json` 존재, 별도 deploy 워크플로 없음). 가이드 등 콘텐츠 발행 = main 직접 푸시.
- 데이터 JSON의 `lastUpdated`는 **UTC(Z)** 표기(KST=+9). 로컬 "현재 기준"은 위 crawl 명령으로 재크롤(src/data·public 양쪽 기록).
