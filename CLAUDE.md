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
- **자동화**: GitHub Actions — 편성·결과·순위·선발투수·인사이트 크롤 + 소셜 3채널(인스타·유튜브 쇼츠·틱톡) 하루 2회 자동 게시

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
│       └── tving.ts        # 티빙 크롤러
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
- GitHub Actions 워크플로우: 편성(`crawl.yml`, KST 08:18 + 백업 10:48·13:48) / 결과·기록(`crawl-results.yml`, 매시 13·43분) / 순위(`crawl-standings.yml`) / 선발투수 / 인사이트 생성·알림 / 소셜 오전(`instagram-morning.yml`)·저녁(`instagram.yml`) — 각각 인스타(캐러셀+릴스+스토리)+유튜브 쇼츠+틱톡 게시. 편성 갱신 시 텔레그램 알림
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

53. 인스타 저녁 게시 전멸 → Meta 일시 장애 내성 강화 (2026-07-19, 커밋 `8a901981`) — 7/19 저녁 워크플로우에서 캐러셀·릴스·스토리 3종 전부 실패(유튜브·틱톡은 성공). **원인 = 우리 버그 아님**: Meta API 쪽 일시 장애(`code=2, is_transient:true`)가 ~5분 지속됐는데 재시도 예산이 고정 15s×5(~75s)뿐이라 못 버팀. 캐러셀은 컨테이너 5개 다 멀쩡했는데 **상태 조회 호출 자체**가 code=2만 돌려줘 60s 폴링 예산 소진으로 사망. **수정**: ①`postMedia` 재시도 8회+지수 백오프(최대 120s, 총 ~10분 커버) ②`waitForFinished`가 is_transient 조회 실패를 폴링 예산과 별도 카운터(30회×10s)로 대기 ③`publish`도 is_transient 재시도 ④**댓글 실패 비치명화**(게시 완료 후 댓글에서 exit 1 → 재실행 시 중복 게시되는 경로 차단) ⑤워크플로 `instagram_only` 입력 신설(아침·저녁 둘 다) — **부분 실패 시 전체 재실행하면 유튜브·틱톡이 중복 게시된다.** (🔴 `instagram_only`·`skip_instagram` 은 2026-08-02 작업76에서 **제거**됐다. 지금은 채널을 직접 고른다: `gh workflow run instagram.yml -f only=carousel,reel,story`) 당일 7/20(결승 전야) 게시분은 이 방법으로 재게시 완료(3종 Media ID 확인).
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

61. 주간 글감 루틴·텔레그램 알림 수정 + 구글 비용 진단 (2026-07-27) — **①notify-ideas 텔레그램 무성 실패 수정**(커밋 `1127958d`): 주간 글감 이슈(#20·#25) 알림이 안 왔음. 원인 = 이슈 본문(예정일정+추천5+글감10)이 텔레그램 4096자 한계 초과 → `sendMessage` 400 `"message is too long"`인데 `curl -s`라 워크플로는 success. 수정 = 3500자 청크(줄 경계 보존) 분할 전송 + 각 응답 `"ok":true` 검사(실패 시 `exit 1`). **`workflow_dispatch(issue_number)` 재전송 경로 신설** — 지난 이슈 재발화용(`issues:opened`만으론 과거 이슈 못 쏨), `gh`로 본문 가져와 이벤트/수동 공통 처리. 무성 실패 복구는 `gh workflow run notify-ideas.yml -f issue_number=N`. **②글감 루틴 요일 밀림 수정**(claude.ai `trig_01M1GZxh` 프롬프트, git 아님): 이슈 #25가 예정일정·추천 요일을 전부 하루씩 밀려 매김(07-29를 화로, 실제 수 → 토요일에 글 배치됨). 프롬프트에 **요일은 반드시 `TZ=Asia/Seoul date -d '날짜' +%a`로 계산, 손 추측 금지 + 자동 발행은 화~금뿐(토·일 배치 금지)** 규칙 3곳 삽입. 다음 실행(08-03 월)부터 적용. content-plan은 #25 추천 5개를 요일 검증된 날짜로 반영(황인범은 7/27 수동 발행, 나머지 1→3→4→5 순 큐 앞으로). **③구글 클라우드 비용 진단**: 7/2 1,504원 = 6월 Gemini Search grounding 사용분(후불). 유일 유료점이 grounding(번역·유튜브는 무료). 사용자가 결제계정 분리해 앞으로 0, 코드 조치 불필요(결제계정 없으면 유료기능은 무료한도까지만·초과시 에러). 상세 [[project-gcp-cost]].

62. 🔴 SEO 전면 재검증 → 결함 4건 수정 + AEO 보강 (2026-07-28, 커밋 `f6310a32`·`2e0732c8`·`84136ae8`) — "노출이 안 된다"는 신고로 라이브 실측. **전제부터 정정됨: 네이버는 노출이 안 되는 게 아니라 클릭이 안 되는 것**(노출 366만 / CTR 0.1%, 구글은 노출 837). 그리고 노출 대부분이 CTR 0%인 "순위" 쿼리에 붙어 있고 CTR 23% 나오는 "편성표·해설" 쿼리엔 노출이 407뿐 — 거꾸로 붙어 있음.
    - **🔴 `robots: rich ? undefined : {...}` 가 layout robots 를 삭제하고 있었음.** Next.js 는 메타데이터 객체에 **명시적으로 존재하는 `undefined` 를 "상속"이 아니라 "해제"로 처리**한다. 그래서 매치 페이지 1,571개(사이트맵의 91%)에 robots·googlebot 메타가 **전무**했고, 작업57에서 디스커버 진입용으로 넣은 `max-image-preview:large` + `max-snippet:-1` 이 사이트의 91%에 적용되지 않고 있었다. 같은 페이지에서 `naver/google-site-verification`·`og:site_name` 은 정상 상속되는 것으로 layout 미적용이 아님을 배제해 원인 확정. **조건부 스프레드 `...(rich ? {} : { robots: {...} })` 로 고쳐야 한다.** 가드 `test:robots-meta`(버그 재도입 시 fail 실증).
    - **팀 페이지 86개가 정식 팀명을 안 쓰고 있었음** — `team.name` 이 순위표 축약 표기(`두산`·`시카고W`·`서울`)라 title·H1·keywords 전부 축약명. 실제 검색어는 정식명이라 매칭 자체가 안 됐다. `src/lib/team-full-names.ts`(KBO 10·MLB 29·K리그1 12·K리그2 12, **미매핑은 축약명 유지 — 확인 안 된 팀명을 추측해 넣으면 틀린 이름이 title 에 박힌다**). 가드 2종: ①매핑 키가 순위표 실표기와 일치 ②정식명이 **편성 데이터 표기와 일치**(이걸로 내가 쓴 `화이트소스`→`화이트삭스`, `레드소스`→`레드삭스` 오표기를 잡았다. 표기가 갈리면 같은 팀이 사이트 안에서 두 엔티티가 된다).
    - **매치 제목 이원화 해소** — 인사이트가 있으면 headline 을 앞세워 팀명·날짜·플랫폼이 뒤로 밀렸다. 네이버 노출을 만드는 쿼리가 **팀명+날짜** 형태(`2026년 07월 16일 kia 타이거즈 ssg 랜더스` 단일 14.7만 노출)라 **정보가 더 많은 페이지가 오히려 검색에 덜 맞는 역전**이었다. 한 포맷으로 통일하고 headline 은 description 으로 이동. description 187~200자 → `clampDescription`(155자).
    - **사이트맵 중복 URL 53건** — 서로 다른 schedule id 가 같은 슬러그를 낼 수 있어(사전방송/본방송) 같은 페이지가 두 번 등록되며 lastmod·priority 만 다르게 주장. `dedupeSitemapEntries` 로 1,730 → **1,677**.
    - **🔴 순위표 → 팀 페이지 링크가 0개였음** — `/standings/kbo` 는 노출 108.9만인데 팀 페이지로 나가는 링크가 하나도 없었고, 정작 팀 페이지 86개는 색인 대기 중이었다. `src/lib/team-links.ts`(리그 id 로 스코프 — 팀명만으로 키를 잡으면 동명 팀이 섞임). 실측 kbo 0→10 · mlb 0→30 · k-league-1 0→12 · mls 0→17, **69개 전부 200 확인**. EPL 0 은 정상(개막 전이라 팀 페이지 없음). **게이트는 홈·사이트맵과 동일(`eligibleTeams`) — 없는 페이지로 링크를 뿌리면 404 양산, 매치 페이지에서 이미 겪은 실수.**
    - **IndexNow 통지에서 팀 페이지 86개 + `/commentary` 가 빠져 있었음** — 목록이 하드코딩이라 색인이 가장 급한 페이지가 통째로 누락. `eligibleTeams` 로 동적 생성(유럽 개막 시 자동 편입). 통지 87개 전부 라이브 200 검증 후 실행 → 156 URL status=200.
    - **AEO**: match/team 에 `FAQPage` 확장(사이트의 91%에 질문형 구조화 데이터가 없었음), `/commentary` 첫 문단을 수치 포함 자기완결 직답으로 교체(AI 인용의 44%가 첫 30% 구간에서 나오고 인용은 문장 단위로 잡힘), `llms.txt` 에 팀·해설 허브 섹션.
    - **🔴 Google 은 `llms.txt` 를 무시한다** — AI optimization guide(2026-06-29): 생성형 AI 기능 포함 Google Search 에 필요하지 않고 순위·노출에 **도움도 해도 되지 않는다**. 파일은 유지하되 **비-Google AI 크롤러용 보조 자료**로만 보고 추가 투자하지 않는다. 같은 문서가 "AEO/GEO 는 SEO 의 리브랜딩"이라고 정리.
    - **AEO 는 이미 상당히 돼 있었음**(AI 봇 20종 명시 허용·llms.txt·풍부한 JSON-LD·SSR·RSS). "AEO 아무것도 안 돼 있다"는 전제는 사실과 달랐다.
    - 도구: `claude-seo` v2.2.4 설치(서드파티 `AgriciDaniel/claude-seo`, 스킬 31 + 에이전트 18, `~/.claude/skills/seo` 1.4GB). **`ai-seo` 라는 스킬은 존재하지 않음** — 해당 기능은 `seo-geo`. **훅은 `settings.json` 에 등록되지 않아 비활성**(수동 설치의 한계, 전역 부작용 없음). 제거는 `uninstall.sh`.
    - 검증: tsc · ESLint · 테스트 **131/131**(신규 22: seo-meta 13·team-full-names 6·robots-meta 3·team-links 4) · 빌드 442 페이지 · **라이브 샘플 25개 결함 0**. 상세 `docs/geo-analysis.md`.
    - **관측(2~4주)**: 색인 수 880 기준 · 해설 쿼리 노출 407 기준 · `/team/` 노출 발생 여부 · 매치 페이지 디스커버 노출.

63. 🔴 SEO 스킬 전량 검증 2차 — 파싱 실패 색인 차단·신호 모순·자동 내부링크·AI 고지 (2026-07-28 오후, 커밋 `e045edea`·`e5c73a4b`·`7ac300d6`) — `claude-seo` 스킬(`seo-technical`·`seo-schema`·`seo-sitemap`·`seo-content`·`seo-images`) 기준으로 전수 재검증. 작업62가 "제가 볼 줄 아는 항목"이었던 반면 여기서는 안 보던 범주가 나왔다.
    - **🔴 특수 경기 편성이 깨진 채 공개되고 있었음(13건)** — 올스타전·실업배구 챔프전은 제목 포맷이 정규 경기와 달라 `league="2026"`, `away="KBO 올스타전 나눔"`, `away="신한 SOL KBO 올스타 프라이데이 퓨처스 올스... 북부리그"`(제공처가 제목을 자름) 같은 행이 있었다. `parsers.ts stripEventPrefix()` 로 접두 제거(**`올스타`(전 없음)로 끝나는 건 팀명의 일부 — `나눔 올스타`·`MLS 올스타`가 실제 팀명이라 건드리면 안 된다**), 아카이브 복구, 그리고 `schedule-quality.ts` 게이트로 **파싱 실패 행을 `isRichMatch` 에서 색인 제외**. 크롤러 10종의 특수 포맷을 전부 역공학하는 건 수렴하지 않으므로 "설명할 수 없는 페이지는 공개하지 않는다"로 잡았다(화면 표시는 유지).
    - **🔴 `parseMatchTitle` 의 homeTeam 이 `cleanTeam` 을 건너뛰고 있었음** (커밋 `10ef52d8`) — `leagueInHome`·`prefixMatch` 두 분기가 `.trim()` 만 걸어서 `KBO리그 LG(26.06.25) vs 삼성` 의 homeTeam 이 `LG(26.06.25)` 로 나갔다. awayTeam 은 정리되므로 **한쪽만 오염**돼 눈에 안 띄었다. "재현 불가"로 판단했다가 테스트를 써보니 정확히 재현됐다 — **추측하지 말고 테스트로 확인할 것.**
    - **🔴 사이트맵과 매치 페이지가 같은 URL에 반대 신호를 내고 있었음** — 서로 다른 id 가 같은 슬러그를 내는 **충돌 228종**이 있는데 행별로 `isRichMatch` 를 돌려서, 사이트맵은 "색인하라"·페이지는 `noindex` 인 URL 이 1건 있었다. 사이트맵을 **슬러그 기준으로 묶고 `findMatchAnywhere` 와 동일 규칙(schedule → worldcup → archive, 각 소스의 첫 일치)으로 대표 행을 골라** 그 행만 판정. 가드 `test:sitemap-consistency`.
    - **🔴 가이드 26편이 편성표로 가는 경로가 없었음** — 자기 링크가 글마다 1개(맨 아래 한 줄, 그마저 절대 URL)뿐이고 본문에서 EPL·티빙을 실명으로 다루면서 링크는 0개. `src/lib/guides/autolink.ts` 로 **렌더 단계에서** 붙인다(본문 파일 무수정 → 발행 산문 보존 + 향후 글 자동 적용). 결과 26편 전부 링크 보유, 자동 링크 66개. **한국어 조사가 핵심 난점** — "뒤에 한글이 오면 다른 단어"로 판정하니 조사를 붙여 쓰는 한국어 문장이 전부 걸러져 링크가 0이 됐다. 조사 화이트리스트로 해결(`고`·`다`·`요` 같은 모호한 글자는 제외). 작업55 idea-dupes 와 같은 함정.
    - **AI 생성 고지가 없었음** — Google helpful-content 가이드가 "How was it created?" 를 평가 항목으로 두고 **AI 보조 콘텐츠에 과정 공개를 기대**한다. 매치 인사이트 섹션에 생성 방식+생성일, `/about` 에 "이 사이트가 만들어지는 방식" 추가. **"운영자가 검수합니다"는 쓰지 않았다 — 작업39에서 검수 게이트를 없앴으므로 사실이 아니다.**
    - **로고 1.26MB 가 웹에 노출되고 있었음** — `logo.png`(3496², 1.26MB)를 구조화 데이터 `image`(페이지당 SportsEvent 최대 50개가 같은 URL)와 OG 렌더가 참조. `logo-1200.png`(199KB)로 **웹 경로만** 교체(릴스·OG 스크립트는 로컬 파일 읽기라 원본 유지). `public/icons/` 2개(1.3MB)는 전 레포 참조 0건이라 제거.
    - **보안 헤더**: 라이브에 HSTS만 있었음 → `X-Content-Type-Options`·`X-Frame-Options`·`Referrer-Policy`·`Permissions-Policy` 추가. **CSP 는 넣지 않았다** — 임베드·광고 스크립트와 얽혀 잘못 쓰면 페이지가 깨지고 그 위험이 순위 이득(가볍다)보다 크다.
    - **🔴 구글 FAQ 리치결과는 2026-05-07 전 사이트 대상 폐지.** 작업62에서 FAQPage 근거로 "SERP 확장"을 적었는데 틀렸다. 유지 근거는 ①AI 답변 엔진 인용 단위 ②화면에 답이 보임 두 개뿐. **구글 리치결과를 근거로 확대하지 말 것.**
    - **조치 불필요로 확인한 것**(중요 — 다시 파지 말 것): 이미지 `alt` 누락 **0건**(219개 중 190개 빈 alt = 장식, 올바름) · width/height 없는 42개는 부모가 치수 고정(`max-h-full` + `object-contain`)이라 CLS 무관 · 리다이렉트 전부 1홉 · 구조화 데이터 28블록에 폐기 타입·플레이스홀더·상대 URL·날짜 오류 0 · IPTC DigitalSourceType 은 Merchant 피드 요구라 해당 없음 · 가이드 저자 정보는 이미 `author: Organization` + 날짜 보유 · 홈 555KB 는 원본 데이터가 112KB 고 나머지가 App Router flight 오버헤드라 이득 작음 · 사이트맵 `priority`/`changefreq` 는 구글이 무시하지만 **네이버가 유입의 78% 라 유지**.
    - **검증 5회 반복**: 테스트 **159/159**(신규 40) · tsc · ESLint · 빌드 442 페이지 · 로컬 사이트맵 전수 1,676 URL × 11개 항목 결함 0 · 라이브 층화표본 63개 결함 0 · OG 이미지 라이브 200 확인 · IndexNow 156 URL 재통지.
    - **새 가드**: `test:robots-meta`·`test:team-name-hygiene`·`test:schedule-quality`·`test:sitemap-consistency`·`test:autolink`·`test:seo-meta`·`test:team-full-names`·`test:team-links` (전부 CI 편입, 되돌려서 fail 실증함).
    - 도구: `claude-seo` v2.2.4(스킬 31·에이전트 18, `~/.claude/skills/seo` 1.4GB). **`ai-seo` 스킬은 존재하지 않음** — 해당 기능은 `seo-geo`. 훅은 `settings.json` 미등록으로 **비활성**(전역 부작용 없음). 제거는 `uninstall.sh`.

64. 🔴 애드핏 심사 통과 → 쿠팡 캐러셀 전량 교체 (2026-07-30, 커밋 `64fcfb6f`·`df29d43b`) — 매체 심사 통과 확인 후 상단(고지 문구 아래·날짜 탭 위) 10페이지 + 홈 인라인(오후 경기 구분선 아래) 2슬롯을 애드핏으로 전환. 상단은 기존 유닛 재사용, 인라인은 **새 유닛 필요**(SDK가 같은 `data-ad-unit` 페이지당 중복을 거부 — "광고 data-ad-unit 은 유일한 값이어야 합니다", 페이지당 최대 4개): `한해설_PC_인라인`(`DAN-lcALm7uz8M1Y77F7`) / `한해설_Mobile_인라인`(`DAN-kJ3thvrkQ3G6WyUG`) 둘 다 300x250. 쿠팡 캐러셀 계열(`ProductCarousel`·`CoupangTopBanner`·`CoupangInlineBanner`)은 전량 제거 — 쿠팡은 이제 우측 사이드 카드(`CoupangSideBanners`)로만 남는다. PC 728 광고가 본문 컬럼(실효 640px)보다 넓어 `-mx-12`로 컬럼을 벗어나게 하고 `ins`에 `shrink-0`(flex item 기본 shrink:1 이라 안 주면 눌린다). 채운 좌측 배너를 직접 조립하던 코드에서 채운이 만든 완성 시안 이미지(WebP 25KB)로 교체. 검증: tsc·ESLint·테스트 19스위트·빌드·브라우저 실측(페이지당 ins 정확히 1개, 728/320/300 정확, 가로 스크롤 0). **채운(자매 프로젝트) 애드핏 작업 상세는 `chaeun` 레포 커밋 로그 참고**(레일 SDK 스캔 타이밍 버그가 핵심 교훈 — [[reference_adfit_sdk_behavior]]). **전체 재검증(같은 날)**: 10페이지 전부 PC·모바일 라이브 실측 — ins 개수·유닛·SDK 스크립트 수·가로 스크롤 이상 없음. `/worldcup`(대진표 전용 라우트, 홈의 "북중미 월드컵" 필터 화면과는 다른 컴포넌트)은 광고 0개인데 **이건 회귀가 아니라 애초에 이 10페이지 목록에 없던 곳** — 헷갈리지 말 것.
65. 채운 배너 로딩 개선 + 우측 쿠팡 사이드 카드 → 애드핏 교체 (2026-07-30, 커밋 `87258a6a`) — 사용자 신고 "채운 배너 로딩 느림" 진단: 원인은 `next/image`가 이미 정확한 표시크기(124x500)로 사전 최적화된 webp(25KB)를 매번 옵티마이저(`/_next/image`) 왕복시키던 것 + 기본 lazy-load. `ChaeunSideBanner.tsx`에 `unoptimized`(옵티마이저 우회)+`priority`(즉시 요청) 추가로 해결. 이어서 우측 사이드(XL≥1280) 쿠팡 상품 카드 2개를 애드핏 160x600(`한해설_PC_오른쪽`, `DAN-CF8kPxnkszA1dow9`)으로 전량 교체 — 쿠팡은 이제 사이트 어디에도 없다. `AdfitBanner.tsx`의 `SLOTS`에 슬롯별 `minWidth`(기본 800 오버라이드)와 `mobile: null` 지원 추가: 사이드 슬롯은 xl 브레이크포인트(1280)가 필요한데 기본 800을 쓰면 800~1279px 구간에서 부모 aside 는 CSS로 숨겨져 있는데(`hidden xl:flex`) 컴포넌트는 "PC 폭"이라 판단해 `<ins>`를 그려버려 **화면엔 안 보이는데 노출만 잡히는 무효노출**이 생긴다(작업64 문서화 원칙 그대로). `mobile: null`이라 1280 미만에서는 `<ins>` 자체를 안 그린다. 죽은 코드 정리: `CoupangProductCard.tsx`·`coupang-product-utils.ts` 삭제(다른 참조 0건 확인), `CoupangBanners.tsx`→`SideBanners.tsx`·`CoupangSideBanners`→`SideBanners`로 파일/컴포넌트명 변경(더 이상 쿠팡이 없어 이름이 안 맞았음). `coupang-products.json`·`fetch-coupang-meta.ts`는 재개 대비로 데이터만 유지(현재 어떤 UI도 참조 안 함). tsc·build 통과 확인 후 커밋+푸시.

66. 북중미 월드컵 기능 제거 + 킥톡 후원 버튼 리서치 (2026-07-30) — **①월드컵 제거**: 대회 종료(2026-07-20) 후 사용자 요청으로 전용 UI·크롤러·워크플로 정리. **삭제**: `/worldcup` 라우트(`page.tsx`+`WorldcupTabs.tsx`+`TournamentBracket.tsx`), `WorldCupView.tsx`·`WorldCupBanner.tsx`(홈 전용 뷰·배너), `lib/crawlers/worldcup.ts`+스크립트 3개(`crawl-worldcup`·`backfill-worldcup-goals`·`gen-worldcup-round-article`), `lib/guides/worldcup-round.ts`(+테스트), `types/worldcup.ts`, `worldcup-standings.json`, GH워크플로 `worldcup-round-article.yml`, `crawl.yml`·`crawl-results.yml`의 월드컵 크롤 스텝(후자는 스스로 "대회 종료 후 제거 가능"이라 주석에 적어놨었음), `package.json`의 `crawl:worldcup`·`backfill:worldcup-goals`·`gen:worldcup-round`·`test:worldcup-round`, 홈 `SPORTS` 배열의 "북중미 월드컵" 필터칩(+연동된 `isWorldCupView` 분기·트로피 아이콘 스타일), sitemap의 `/worldcup` 허브 엔트리, 가이드 자동링크의 "북중미 월드컵"/"월드컵"→`/worldcup` 엔트리(가리킬 곳이 없어짐). **유지(의도적)**: 이미 발행된 가이드 글 20여 편(`content/guides/worldcup-*.md`, 사용자 선택), `match-insights/worldcup-*.json`, 그리고 **`worldcup.json` 자체**— `loadScheduleData()`가 이걸 `schedule.json`에 계속 병합해 매치 페이지·OG이미지·사이트맵·results lookup·가이드 백링크가 안 깨지게 유지(이미 색인된 URL·SEO 트래픽 보존). `/worldcup`은 `next.config.mjs`에 301(`/worldcup`, `/worldcup/:path*` → `/`)로 IndexNow 통지 이력 있는 URL이 404 안 나게 함. **손 안 댄 것**: `hero-pick.ts`·`hashtags.ts`·`instagram.ts`의 월드컵 히어로 선정 로직 — 각 파일 스스로 "데이터(worldcup.json) 부재/과거화 시 자동 비활성"이라 주석에 적혀 있고 실제로 향후 날짜에 월드컵 일정이 없어 이미 죽어있어 건드릴 필요·이득이 없었음(리스크만 있음). **발견(후속 과제로 남김, 미조치)**: `page.tsx`가 `worldcup.json`(50KB) 전체를 매 홈 로드마다 클라이언트 초기 payload에 무조건 실어보내고 있음 — 대회가 끝나 그 데이터가 기본 7일 뷰에 절대 안 걸리는데도, archive(과거 날짜 조회) 브랜치의 `worldcupSchedules`가 같은 `data.schedules` prop에서 파생돼 트리밍이 안 됨. 일반 archive(`schedule-archive.json`)처럼 지연 fetch로 옮기면 50KB 절감 가능하지만 이번 스코프 밖이라 미실행. **최종검증에서 추가로 잡은 것 둘**: ①**워크플로 `git add` 목록에 내가 삭제한 `worldcup-standings.json` 경로가 남아 있었으면 매시 크롤이 pathspec 에러로 통째 실패**할 뻔했음(편집으로 제거됨 — `crawl-results.yml` 수동 dispatch 해서 전 스텝 success 실증, `crawl.yml`은 텔레그램·IndexNow 부작용 있어 dispatch 대신 `git add` 대상 5개 파일 존재 전수 확인). ②`generate-match-insights.yml`이 **월드컵 백필 모드로 남아 있었음**(`INSIGHTS_DAYS_AHEAD` 기본 44 + `worldcup_only` 입력) — 워크플로 주석이 스스로 "대회 종료 후 정리할 것"이라 적어둔 항목. 기본값 6으로 되돌리고 `worldcup_only` 입력·`INSIGHTS_WORLDCUP_ONLY` 분기 제거. **동작상 무해했음을 먼저 확인하고 지웠다** — `inDateRange`가 today~today+N이라 과거 월드컵 경기는 애초에 범위 밖이고 일반 경기는 schedule.json 이 7일치라 44나 6이나 같았음. 검증: tsc·build·관련 테스트(sitemap-consistency·schedule-quality·autolink·team-name-hygiene) 통과, 라이브에서 `/worldcup` 301·월드컵 매치페이지 200·홈 콘솔에러 0·가로스크롤 0·좌우 배너 정상 확인. **②킥톡(kicktalk.xyz) "응원하기" 버튼 리서치**(구현은 안 함, 조사만): 백엔드 없이 순수 클라이언트 계단식 딥링크. `supertoss://send?amount=N&bank=토스뱅크&accountNo=...` 로 토스 앱 열기 시도(`document.hidden`으로 2.5초 내 앱 전환 여부 판별) → 실패시 카카오페이 고정금액 송금 QR 링크(`qr.kakaopay.com/...`, 카카오페이 앱에서 직접 생성)로 폴백 → 그것도 실패시 계좌번호 노출+복사 버튼. 토스 인앱브라우저 전용 `window.tossPay.donate(sku)` 브릿지(토스 크리에이터 후원 가맹점 등록 필요)는 최상위 경로로 시도하지만 우리가 바로 쓸 수 있는 건 아님. 이식하려면 사용자의 실제 계좌(공개 레포에 노출)와 카카오페이 고정금액 QR 링크가 필요 — 구현은 그 정보 받으면 진행.

67. 후원("응원") 버튼 구현 (2026-07-30) — 작업66 리서치를 실제 구현. `src/app/_components/DonateButton.tsx`, 홈 헤더(`ScheduleClient`)에 `한해설 Topic`·`순위 +` 왼쪽 배치. **결제 대행사·백엔드 0** — 금액 선택 → `supertoss://send?amount=N&bank=<인코딩>&accountNo=...&origin=qr` 딥링크 → 실패 시 계좌+복사 버튼. 티어 3단(하이라이트 1,900 / 풀타임 4,900 / 시즌권 9,900 — 일 110명 트래픽엔 소액이 현실적이라 kicktalk의 3,900~19,900보다 낮춤).
    - **🔴 계좌는 환경변수로만 받는다(하드코딩 금지).** 이 레포가 public 이라 하드코딩하면 계좌가 **깃 히스토리에 영구히** 남는다. 다만 `NEXT_PUBLIC_*`은 빌드시 번들에 인라인되므로 **브라우저 소스 보기로는 여전히 보인다** — 후원 계좌라 그건 의도된 것이고, 막는 건 깃 히스토리·GitHub 검색 노출뿐. 이 구분을 흐리지 말 것.
    - **앱 설치 판별 = `document.hidden`** — 딥링크 후 2.5초 안에 탭이 백그라운드로 안 가면 미설치로 본다. 웹에서 이걸 알 방법이 이것뿐이다. 연타 방지 락(`busyRef`) 필요.
    - **카카오페이 링크는 금액이 고정**(앱에서 금액을 정해 만든다). 그래서 아무 티어에나 띄우면 사용자가 **다른 금액을 보내게 된다** → `KAKAOPAY_AMOUNT`와 티어가 일치할 때만 노출하도록 짰다. kicktalk 도 3,900원 하나에만 걸어놨던 이유가 이것.
    - **미설정 시 자동 숨김**(`PushSubscribeButton`과 같은 패턴) — 값 넣기 전엔 헤더가 기존 2버튼 그대로. 실측 검증함.
    - 검증: tsc·ESLint·build(418 페이지) 통과 + 로컬 dev에 가짜 계좌 주입해 **모바일 375px 실측**(3버튼 가로 넘침 0) · 모달 열림 · 티어 3개 렌더 · **폴백 경로 실제 도달**(헤드리스엔 토스 앱이 없어 정확히 그 시나리오, "토스 앱이 열리지 않았어요"+계좌+복사 표시) · 환경변수 뺀 서버에서 버튼 미렌더 확인. 헤더 3버튼 수용 위해 좌우 패딩 `px-4`→`px-3`, 간격 `gap-3`→`gap-2`(모바일만, sm 이상은 그대로).

68. 후원 버튼 후속 — 카카오페이 티어별 지원 + 🔴 `NEXT_PUBLIC_*` 미치환 진단법 (2026-07-30) — **①카카오페이가 한 금액만 되던 것 수정**: 작업67은 `KAKAOPAY_URL`+`KAKAOPAY_AMOUNT` **쌍 하나**만 받아 그 금액 티어에서만 버튼이 떴다(카카오페이 링크가 금액 고정이라 그렇게 짰지만, 링크를 여러 개 만들면 되는 걸 안 받고 있었다). → **환경변수 이름에 금액을 박는 방식**으로 전환: `NEXT_PUBLIC_DONATE_KAKAOPAY_1900`/`_4900`/`_9900`. 이러면 **금액 불일치가 구조적으로 불가능**하고 티어별 선택 설정도 된다. **🔴 `process.env["..."+amount]` 처럼 동적 조립하면 webpack 이 치환을 못 해 항상 undefined** — 셋을 리터럴로 각각 써야 한다(TIERS가 고정 목록이라 문제없음). 검증: 1900·9900만 설정하고 4900은 비운 상태로 세 티어 전수 실측(설정된 티어만 링크, 미설정 티어는 계좌 폴백만, 금액 교차오염 0).
    - **②`NEXT_PUBLIC_*` 이 안 먹었는지 판별하는 법(재사용할 진단)**: 사용자가 Vercel 에 변수를 넣고 재배포했는데도 버튼이 안 떴다. 배포된 클라이언트 청크를 직접 받아 보니 `U=F.env.NEXT_PUBLIC_DONATE_BANK` 처럼 **런타임 조회가 그대로 남아 있었다**. 값이 있었다면 webpack 이 `U="토스뱅크"` 로 **리터럴 치환**하므로, 조회가 남아 있다는 것 자체가 **빌드 시점에 변수가 없었다는 증거**다. 코드 배포 여부와 변수 주입 여부를 이걸로 깔끔히 분리할 수 있다(청크에 컴포넌트 문구·`supertoss://send` 는 있었으므로 코드는 배포됨 = 변수만 문제). 원인 후보는 ⓐRedeploy 시 "Use existing Build Cache" 체크 ⓑProduction 스코프 미체크 ⓒ변수명 오타 — 셋 다 같은 증상이라 번들만으로는 못 가른다.
    - **홈은 `revalidate=60` + CDN 캐시라 쿼리스트링을 붙여도 캐시 우회가 안 된다**(`X-Vercel-Cache: HIT` 유지). 배포 반영 확인은 HTML 대신 **청크 내용**을 보는 게 확실하다.

69. 후원 버튼 2단계 UX (2026-07-30) — 사용자 요청으로 **금액 선택 → 앱 선택** 2단계로 변경. 종전엔 금액을 누르면 **토스를 자동으로 열고** 실패하면 카카오로 넘기는 연쇄였는데, 무엇이 열릴지 모른 채 앱이 튀는 게 불친절했다. 이제 2단계에서 **토스(파랑 `#3182F6`) / 카카오페이(노랑 `#FEE500`) 타일 2개**를 보여주고 누른 것만 연다. `Phase`에 `method` 상태 추가(`pick → method → opening → fallback`), 금액·카카오링크를 단계 간에 들고 다녀 되돌아가도 유지된다.
    - **브랜드 로고 이미지를 쓰지 않았다** — 브랜드 컬러 배경 + `toss`/`pay` 텍스트 타일로 처리. 공식 로고 파일은 상표 문제와 에셋 관리(CSP·용량)가 붙는데 식별 효과는 같다.
    - **카카오 타일은 그 티어에 링크가 설정됐을 때만 보인다.** 눌러도 안 되는 버튼을 띄우는 게 더 나쁘다. 현재 카카오 변수 3개가 다 비어 있어 **라이브에선 토스 하나만 뜬다** — 사용자가 링크 만들어 주면 2개가 된다.
    - 계좌 경로는 두 갈래로 항상 열려 있다: 2단계의 "계좌번호로 직접 보내기" 링크 + 앱이 안 열렸을 때 자동 폴백.
    - 검증: 카카오를 1900 만 설정한 상태로 실측 — 1900 은 타일 2개, 4900 은 토스만, 단계 왕복 시 금액 유지(4,900원), 계좌 폴백에 은행·예금주·금액 정확, 콘솔 에러 0, 모바일 390px 가로 넘침 0.
    - **부수 정리(같은 날)**: 폐기된 `NEXT_PUBLIC_DONATE_KAKAOPAY_URL`·`_AMOUNT` 를 Vercel Production·Preview 에서 제거(새 코드가 안 읽는 변수). `vercel link` 가 `.gitignore` 에 `.env*` 를 추가했는데 추적 중인 env 파일이 없어 안전하고, 계좌를 다루는 지금 유용한 안전장치라 남겼다.
    - **🔴 `vercel env pull` 은 값을 안 내려준다(전부 빈 문자열로 씀).** 이걸 근거로 "사용자가 값을 안 넣었다"고 판단했다가 틀렸다 — 이미 작동이 확인된 `BANK`·`ACCOUNT` 조차 pull 결과가 빈값이었다. **환경변수가 실제로 주입됐는지는 배포된 클라이언트 청크에서 확인할 것**(값이 들어갔으면 `env.NEXT_PUBLIC_*` 런타임 조회가 사라지고 리터럴로 치환된다). 카카오 3개도 이 방법으로 주입 확인했다(`qr.kakaopay.com` 3건 인라인).
    - **버튼 디자인(같은 날, 사용자 요청)**: 캡슐(`btn-caps-stripe`) → **글래스 알약**(`.liquid-glass` + `rounded-full`, `.liquid-glass` 는 radius 를 안 갖고 있어 같이 줘야 한다) + 아이콘 ☕ → **💰**. 옆 버튼들과 시각적으로 구분해 CTA 성격을 살렸다.

70. 후원 띠배너 전환 + 🔴 쿠팡 제휴 고지 전량 제거 (2026-07-30) — **①헤더 버튼 → 띠배너**: 헤더에 버튼이 3개가 되면 모바일이 빡빡해서, 사용자 요청대로 헤더와 fadeby 배너 사이 가로 띠로 옮겼다. `DonateButton` 에 `variant` prop 추가(`pill`|`strip`). 문구는 "오늘 보실 경기, 원하는 팀이 이기길 🙏". **문구만 두면 눌렀을 때 후원 모달이 뜰 걸 예상할 수 없어 오른쪽에 `응원 ›` 를 붙였다**(낚시 방지). **문구 톤은 의도적으로 도박을 명시하지 않았다** — 사용자 원안은 "따실 거다·수익 보실 거다"였는데, 애드핏이 돌고 애드센스를 노리는 상황에서 사이트가 배팅 보조로 분류될 리스크가 있어 대안을 제시하고 사용자가 "재밌게 에둘러"를 골랐다. 티어명은 `air`/`pro`/`max`(⚡🔥👑) — 애플 라인업 관용구라 등급 감각이 즉시 잡힌다(직전 하이라이트/풀타임/시즌권은 사용자가 반려). 모달 부제에 줄바꿈 추가.
    - **②🔴 쿠팡 파트너스 고지 4곳 제거** — 작업64(캐러셀)·65(사이드 카드)로 **쿠팡 링크가 사이트에서 완전히 사라졌는데 고지 문구만 남아 있었다**(홈·`/standings`·`/standings/[slug]`·`FilteredScheduleView`). 없는 제휴를 표시하는 셈이라 사실과 어긋난다. 화면 렌더되는 4곳 전부 삭제. **남은 "쿠팡" 언급은 전부 쿠팡플레이(중계 플랫폼)라 편성 데이터의 일부 — 지우면 안 된다.** `/about`·`/faq`·약관에 제휴 서술은 없음을 확인했다. `coupang-products.json`·`fetch-coupang-meta.ts` 는 재개 대비로 데이터만 유지(참조하는 UI 0).

71. 🔴 우측 배너가 안 뜬 진짜 원인 = 슬롯 마운트 시점 불일치 + 인라인 규격 728x90 (2026-07-30) — **①우측 애드핏이 반복해서 빈칸이던 것을 구조로 고쳤다.** 애드핏 SDK 는 문서를 **한 번만** 훑는데, `SideBanners`(우측)만 인트로 종료(~1.2초)를 기다려 `null` 을 렌더하고 홈 상단 슬롯은 즉시 마운트돼 SDK 를 붙여 스캔을 끝내버렸다 → **뒤늦게 나타난 우측 `<ins>` 는 아무도 스캔하지 않음.** `AdfitBanner` 의 2.5초 재스캔 안전망도 "채워진 광고가 하나라도 있으면 재삽입 안 함" 조건 때문에 구제 못 했다(상단이 이미 채워져 있으므로). 재방문 시엔 인트로가 스킵돼 우연히 동시 마운트되어 **가끔 되는 것처럼 보인 것**이 진단을 흐렸다.
    - **🔴 헤드리스에서는 이 버그가 안 보인다** — SDK 가 헤드리스를 탐지해 아무것도 채우지 않으니 `hasFilledAd()` 가 false 가 되고 재스캔이 돌아 정상처럼 나온다. **자동 검증으로 못 잡는 부류라 구조로 막아야 한다.**
    - 해결: `src/app/_components/ads-ready.ts` 신설 — 리스너·폴백 타이머를 **모듈 단위로 하나만** 두고 구독자 전원에게 동시에 알린다(`useAdsReady`). `SideBanners` 와 `AdfitBanner` 가 같은 신호를 쓰므로 모든 `<ins>` 가 **같은 커밋에** 들어가고, 그 뒤 첫 슬롯이 붙이는 단 한 번의 스캔이 전부를 잡는다. **재스캔에 의존하지 않는 설계로 바꾼 게 핵심** — SDK 에 "처리 완료" 마킹 속성이 없어(`ba.min.js` 확인) 재스캔이 이미 채워진 유닛을 다시 렌더할 위험을 배제할 수 없다.
    - 검증: ins 개수 전이를 촘촘히 샘플링해 `0/0 → 3/1`(0개에서 3개가 한 번에, 그때 스크립트 1개) 확인. 종전엔 2개가 먼저 뜨는 구간이 있었다.
    - **②홈 인라인 PC 규격 300x250 → 728x90** — 사용자가 애드핏 대시보드에서 유형을 바꿨다. **`data-ad-width/height` 가 코드에 있어 대시보드만 바꾸면 불일치로 안 채워진다**(SDK 가 그 값으로 소재를 요청). 코드도 728x90 으로 맞추고, 728 은 본문 컬럼(실효 640)보다 넓으므로 상단 슬롯과 같은 `min-[800px]:-mx-12` breakout 추가(640+96=736 ≥ 728). 모바일 인라인은 300x250 유지라 `min-h` 를 규격별로(모바일 250 / PC 90) 잡았다.

72. 후원 UI 다듬기 + 코드 정리 (2026-07-30) — 사용자 피드백 반복 반영. **띠배너**: 문구 "내가 응원하는 팀이 지고있다면?" 중앙정렬 + `🎉 응원하기 ›`, 세로 패딩 `py-2.5`→`py-4`(sm `py-5`, 높이 51px). 중간에 "오늘 보실 경기…응원할게요!" 안을 거쳤는데 **모바일 390px 에서 한 줄에 안 들어가 잘렸다**(문구+CTA 합계가 가용폭 초과) — 문구가 짧아지며 해소됐다. **모달**: `금액 다시 고르기` 제거, `토스`/`카카오페이` 타일에 **인라인 SVG 심볼** 적용(외부 이미지 대신 — CSP·CDN 의존 0, 용량 0), 부제 줄바꿈, 티어명 `air`/`pro`/`max`(⚡🔥👑).
    - **코드 정리(사용자가 요청한 "최적화 검증")**: ①`Phase` 유니온이 `amount`·`kakaopay` 를 4개 변형 중 3개에 중복 보관해 `phase.kind === "pick" ? 0 : phase.amount` 같은 가짜 기본값이 필요했다 → **`step` + `tier` 두 상태로 분리**. 금액은 한 곳에만 있으므로 단계 왕복 시 어긋날 여지가 없다(실측: 3단계 갔다 2단계로 돌아와도 4,900원 유지). ②`variant="pill"` 분기는 **어디서도 안 쓰는 죽은 코드**라 제거(헤더에서 띠배너로 옮긴 뒤 남은 잔재). ③`tier.kakaopay!` non-null 단정을 지역 const 로 걷어냄(state 필드는 클로저에서 좁혀지지 않아 단정이 필요했던 것). 356줄 → 324줄.
    - 검증: tsc·ESLint·build(418) + 모바일 390px 실측(문구 안 잘림·가로 넘침 0·패딩 16px) + 3단계 전 흐름(카카오 미설정 티어는 토스만, 계좌 폴백에 은행·예금주·금액 정확, 왕복 시 금액 유지, 콘솔 에러 0).
    - **띠배너 최종형(같은 날 추가)**: 문구는 **박스 정중앙**, `🎉 응원하기` 는 우측, `›` 제거, 글자 확대(13px/sm 15px), 테두리에 **회전 네온**. **`.border-glow` 는 이미 globals.css 에 있었는데 아무도 안 쓰고 있어서 그대로 재사용**했다(conic-gradient + `border-rotate`, `@property --border-angle`). `.liquid-glass` 대신 쓰는 이유는 `.border-glow` 가 `padding-box` 를 `#0a0a0a` 로 채우는데 **페이지 배경이 같은 색이라 티가 안 나기** 때문. `.liquid-glass` 는 `InstallPrompt` 가 계속 쓰므로 유지.
      - 🔴 **정중앙은 flex 로 안 된다** — 문구와 CTA 를 나란히 놓으면 "둘 사이의 가운데"가 된다. 문구만 `justify-center`, CTA 는 `absolute right-*` 로 띄워야 박스 기준 중앙이 된다(실측 중앙오차 0px, 320~1280px 전 폭).
      - 🔴 **absolute CTA 는 좁은 폭에서 문구를 덮는다.** 실측: 390px 여유 7px / **360px 8px 겹침 / 320px 28px 겹침**. `truncate` 는 이 경우 안 먹는다(문구가 잘리는 게 아니라 겹침). → `min-[400px]` 미만은 문구를 "응원하는 팀이…"로, `min-[340px]` 미만은 CTA 라벨까지 숨겨 해결(320px 여유 38px). **폭별 실측 없이 absolute 겹침을 눈으로 판단하지 말 것.**

73. 응원 배너 카카오페이형 재설계 + 티어·토스 심볼 정리 (2026-07-31, 커밋 `55b1e755`·`4024f954`) — 작업72의 띠배너(중앙 문구 + absolute CTA + 회전 네온)를 **카카오페이 홈 광고 행 구조**로 바꿨다: `[아이콘] + [작은 회색 윗줄 / 굵은 아랫줄 ›]`. 좌측 정렬 2줄이라 **작업72에서 폭별로 막아야 했던 문구-CTA 겹침 문제 자체가 사라졌다**(`min-[400px]`·`min-[340px]` 분기 제거).
    - **배경 `#FEE500` 단색**(사용자 지정). 페이지가 거의 검정이라 이 한 덩어리만 노랗게 두면 시선이 잡힌다. `.border-glow` 는 노랑 위에서 지저분해 제거(`.liquid-glass` 는 `InstallPrompt` 가 계속 씀). 글자는 대비 때문에 검정 계열(`black/60` + `#191600`).
    - **치수는 카카오페이 앱 캡처 실측을 그대로 옮겼다** — 모바일 366×78(아이콘 44 + 상하 16, 좌우 14, 윗줄 13px / 아랫줄 16px 볼드, radius 16), PC 는 비례 확대(672×96). 문구 "오늘만큼은 꼭 이겨야 한다면 / 승리 기원 응원하기 ›". **문구 후보를 20개 뽑아 고르게 했고, 배팅은 끝까지 명시하지 않았다**(애드핏 송출 중 + 애드센스 노리는 상황에서 배팅 보조로 분류될 위험 — 작업70과 같은 판단).
    - **티어 `air/pro/max` → `Air/Pro/Max`, 이모지 `⚡🔥👑` → `☁️⚡🔥`**(구름→번개→불로 단계 상승). 모달 2단계 문구는 "1,900원" 다음 줄바꿈 후 "어떤 앱으로 보낼까요?"(한 줄일 때 금액과 질문이 붙어 읽혔다).
    - **토스 타일 = 배포된 공식 심볼**(`Toss_Symbol_Primary` 트림 후 96px webp 3.3KB, 흰 타일 위 파란 심볼 = 토스 앱 아이콘 방식). 직접 그린 인라인 SVG 로는 파란 그라데이션을 흉내 낼 수 없었다. 카카오는 말풍선 하나라 인라인 SVG 유지.
    - **🔴 이 배너의 아이콘 Lottie 는 시도 후 폐기.** (여기 "Lottie 는 다시 하지 말 것"으로 적어 뒀었는데 **일반화가 지나쳤다** — 폐기 이유는 Lottie 가 아니라 **고른 소재의 구도**였다. 아래 정정 항목 참조.) LottieFiles 선물 애니메이션 2종을 **애니메이션 WebP 로 구워**(174×104, 18프레임 2초, 44KB) 실제 배너에 올렸는데, 그 소재가 아이콘이 아니라 **폭죽 장면**이라 상자가 캔버스의 27% 뿐이었다. 116×69 까지 키워도 상자는 28px 로 정지 아이콘(44px)보다 작아 보였고, 상자를 44px 로 하려면 캔버스가 274px 필요해 배너가 감당 못 한다. 사용자 판단으로 정지 아이콘 유지.
      - 굽는 방법은 남겨 둔다(다른 데 쓸 수 있음): lottie-web 캔버스 렌더 → 프레임 스트립 PNG → 투명 여백 자동 크롭 → **`ffmpeg -c:v libwebp_anim -pix_fmt yuva420p`**. **sharp 로는 안 된다** — raw + `pageHeight` 로 넘겨도 `n-pages` 가 없어 그냥 긴 이미지 한 장이 나온다. 용량은 프레임 수가 지배하고 화질 q 는 거의 영향 없다.
      - **🔴 정정(2026-07-31): 여기 적혀 있던 "`lottie-web` 런타임 gzip 250KB" 는 틀린 수치였다.** 그건 full 빌드의 **raw** 값(298KB)이고, 실측은 이렇다 — `lottie.min.js` raw 298.4 / gzip 75.0 / brotli 62.2KB · **`lottie_light.min.js`(svg 전용) raw 164.3 / gzip 45.7 / brotli 39.4KB** · `lottie_svg.min.js` gzip 61.4KB. 즉 svg 렌더러만 쓰면 40KB 대다. 그 잘못된 수치를 근거로 런타임을 "애초에 배제"했었는데, **채운에서 같은 판단을 다시 재 보니 결론이 뒤집혔다**: 글로우가 있는 소재는 부드러운 그라데이션이 압축을 방해해서 구운 WebP 가 **176×118·30fps 에 268KB**(240px 426KB · 320px 644KB)나 됐고, 런타임(lottie_light 39.4 + json 9 = **48KB brotli**)이 5분의 1이면서 벡터라 60fps 에 선명했다.
      - **판단 기준(이걸 보고 고를 것)**: 소재가 **단순한 도형·평면 색**이면 구워서 WebP 가 작다. **글로우·블러·그라데이션**이 있거나 프레임이 많으면(60프레임+) 런타임이 이긴다. LCP 걱정은 굽는 것으로 피하지 않고 **지연 로딩으로 푼다** — 유휴 시간 동적 import + 정지 한 컷 포스터 + `prefers-reduced-motion` 이면 미로딩 + 탭 숨으면 정지. 채운 구현은 `chaeun/components/FishGlow.tsx` 에 있다(초기 HTML 이 그 청크를 참조하지 않는 것까지 확인).
    - **🔴 Windows 세션 운영 규칙 신설**(같은 커밋, CLAUDE.md "세션 운영 규칙" 절 + `.claude/settings.json`) — 작업 중 사용자가 "백그라운드 셸 실패 알림"·"터미널 창이 계속 뜬다"고 두 번 지적했다. 원인은 ①백그라운드 `next dev` 가 재컴파일마다 콘솔을 띄우고 ②종료 시 실패로 보고되고 ③120초 넘는 명령이 자동으로 백그라운드로 넘어가는 것. **Bash 기본 타임아웃 300초·최대 600초를 `.claude/settings.json` 에 넣고 레포에 추적**시켰다(`.gitignore` 를 `.claude/*` + `!.claude/settings.json` 으로 — **디렉터리째 무시하면 git 이 안으로 안 들어가 예외가 안 먹는다**). 개인 권한 기록 `settings.local.json` 은 계속 제외.

74. 🔴 홈 본문 소개 섹션 제거 + 푸터 통합 + 한글 줄바꿈 정리 (2026-07-31, 커밋 `117724f0`·`ed416875`·`c3b4116d`) — 사용자 요청으로 홈에서 편성표 아래를 전부 걷어냈다: `이번 주 빅매치` · `한해설 Topic` 카드 · 서비스 소개 블록(한해설이란?·지원 종목·지원 플랫폼·리그별·팀별·이용 가이드·자주 묻는 질문). **홈 본문은 이제 편성표 하나뿐.** `HomeAboutSection.tsx`·`GuideCards.tsx` 삭제(`WeekHighlights` 는 리그·플랫폼 페이지가 계속 씀).
    - **🔴 푸터가 실제로 두 개였다** — `layout.tsx` 전역 푸터 + `app/page.tsx` 안의 홈 전용 푸터. 홈에서 둘 다 렌더돼 같은 목적지 링크가 이름만 달리 두 번 나왔고(순위/팀 순위, 소개/한해설 소개, FAQ/자주 묻는 질문), 반대로 **개인정보처리방침·이용약관은 홈에만 있어 나머지 페이지에서 닿을 수 없었다.** `src/app/_components/SiteFooter.tsx` 하나로 합치고 정책 링크를 전역으로 올렸다. 지금 푸터 = 메뉴 8개 + 데이터 고지 + 저작권.
    - **🔴 허브 칩(리그 13·플랫폼 10·팀 85)을 "SEO 때문에" 다시 넣지 말 것.** 잠깐 푸터로 옮겼다가(`117724f0`) 걷어냈다(`ed416875`). 전역 푸터면 매치 페이지 1,600여 장 전부에 같은 칩이 실리는데, 그 링크는 이미 문맥 맞는 자리에 다 있다(빌드 산출물 실측): **플랫폼**=경기 카드 `PlatformBadge` 가 전부 `/platform/{slug}` 링크(홈 본문 9개, 푸터 10개와 사실상 중복) + `/commentary` 10개 / **리그**=매치 페이지 브레드크럼·컨텍스트, 순위표, 팀 페이지(프리렌더 매치 243장 중 슬러그 매핑되는 104장 보유) / **팀**=순위표 팀 링크(kbo 10·mlb 30)와 매치 페이지 팀 태그(243장에 223건). 셋 다 사이트맵·IndexNow 포함. 남는 손실은 "홈에서 리그 페이지로 가는 링크"뿐인데 리그당 매치 수백 장이 걸려 있어 측정될 수준이 아니고, GSC 최고 성과 페이지 `/platform/coupang-play` 는 카드 링크로 유지된다.
    - **홈 FAQPage JSON-LD 도 함께 사라졌다** — `/faq` 가 자기 세트(질문 더 많음)로 이미 내보내므로 한 사이트에 두 벌 돌던 게 정리된 것. `/about` 도 "한해설이란?"·이용 가이드를 이미 갖고 있어 본문 블록은 중복이었다.
    - **하단 SEO 문단 줄바꿈**(`c3b4116d`): ①`break-keep`(word-break: keep-all) — 기본값은 한글을 **글자 단위**로 끊어 `쿠팡플/레이`·`편성표/를` 처럼 어절을 자른다. 이게 제일 큰 차이 ②리그 나열 `·` **뒤**에 zero-width space — 공백 없는 한 덩어리라 keep-all 이어도 브라우저가 점 **앞**에서 끊어 다음 줄이 `·KBO·MLB…` 로 시작했다(390px 실측) ③플랫폼 이름 안 공백을 nbsp — `SBS / Sports`, `MBC / SPORTS+` 가 갈렸다. 보조로 `text-pretty`·`max-w-[38rem]`·`sm:leading-7`. **`<br>` 수동 금지**(폭 바뀌면 그 자리가 어색해진다). 상수는 `ScheduleClient.tsx` 상단 `SEO_LEAGUES`·`SEO_PLATFORMS`, **보이지 않는 문자는 `​`·` ` 이스케이프로 쓸 것**(리터럴은 편집 중 조용히 사라진다).
    - **후원 티어 아이콘 = 3D 이미지**(달·번개·불, `public/tier-{air,pro,max}.webp`). 🔴 **높이로 맞추면 안 된다** — 트림 후 비율이 제각각(달 361×406·번개 244×434·불 324×423)이라 높이 통일 시 번개만 작아 보이고, 면적으로 맞추면 반대로 번개가 커 보인다. **둘의 중간값**으로 96px 캔버스 정중앙(달 76×86 / 번개 54×96 / 불 64×84). 세 안을 다 렌더해 비교하고 골랐다.
    - 검증: tsc · ESLint · build 414 페이지 · 테스트 145/145 · 390/768/1440px 실측 · **라이브 `haeseol.com` 실측**(footer 1개, 푸터 리그칩 0, 본문 플랫폼 링크 9, ZWSP 8·NBSP 7 삽입 확인).

75. 채운에 응원(후원) 이식 + 랜딩 다듬기 + 최적화 (2026-07-31, **채운 레포** 커밋 `0e90736`·`8d19005`·`e9f784e`·`f46f028`·`f1c151e`·`5943202`·`fb65b21`·`347f4b3`·`dfcea5b`) — 작업67·73 의 후원 컴포넌트를 자매 프로젝트 채운(`chaeun.haeseol.com`)에 옮겼다. **상세는 그 레포의 `CLAUDE.md` 에 적었다**(여기서는 한해설에 되돌아오는 것만 남긴다).
    - **두 사이트가 같은 계좌·같은 카카오 링크 3개를 쓴다** — 계좌를 바꾸면 양쪽 Vercel 환경변수를 다 고쳐야 한다. 값은 한해설 배포 청크에서 그대로 꺼내 옮겼다(`NEXT_PUBLIC_*` 는 원래 브라우저에 노출되는 값이라 가능한 것이고, 새로 노출된 것은 없다).
    - 🔴 **작업73 의 "lottie-web 런타임 gzip 250KB" 가 틀린 수치였다**(커밋 `2be0e621` 로 정정). full 빌드의 **raw** 값이고 실측은 `lottie_light`(svg 전용) **gzip 45.7 / brotli 39.4KB** 다. 그 잘못된 수치로 런타임을 "애초에 배제"했었는데, 채운에서 다시 재 보니 **결론이 뒤집혔다** — 글로우가 있는 소재는 구운 WebP 가 268KB(320px 은 644KB)나 되고 런타임은 48KB(brotli)에 벡터라 60fps 로 선명했다. **소재가 단순 도형이면 굽고, 글로우·블러·다프레임이면 런타임**을 쓴다. LCP 는 굽는 것으로 피하지 말고 지연 로딩으로 푼다.
    - 🔴 **눈으로 판단하지 말고 재야 하는 것을 또 확인했다.** ①"시트가 첫 열기만 끊긴다" → BirthForm 마운트를 의심해 한 프레임 미뤘는데 **차이 0**. CPU 프로파일을 뜨니 JS 는 5ms 미만이고 브라우저의 스타일·레이아웃·페인트가 38.8% 였다(전면 시트의 **첫** 페인트 값). 유휴 시간에 껍데기를 미리 그려 롱태스크 96~118ms → 55~66ms. ②"물고기가 왼쪽에 붙어 보인다" → 2px 씩 세 번 밀었는데 체감이 없었고, 픽셀로 재 보니 **88px 상자 안에서 잉크가 x=4~87 을 오갔다**(위치가 아니라 헤엄치는 폭 문제). 한 번에 20px 옮겨 최소 거리 16→23px.
    - 채운 쪽 정리도 같이 했다(죽은 코드 441KB·597줄, 히어로 포스터 397→248KB, 마크 좌표 4곳 → `lib/mark-shape.ts` 한 곳). **포스터를 WebP 로 바꾸지 않은 이유**는 OG 카드 두 곳이 런타임에 그 파일을 쓰고 next/og 가 Windows 로컬에서 검증이 안 되기 때문 — 한해설의 `vercel-og-live-verify` 교훈과 같은 자리다.

76. 🔴 저녁 릴스만 실패 → 컨테이너 일시 오류 재시도 + 채널별 실패 보고 (2026-08-02, 커밋 `bcd08e1e`) — 저녁 워크플로에서 **릴스만** 실패하고 캐러셀·스토리·유튜브·틱톡은 정상 게시됐다. 텔레그램엔 "실패, 로그 확인" 한 줄만 가서 무엇이 빠졌는지 알 수 없었다.
    - **원인**: 컨테이너 **생성(`postMedia`)은 성공**했고, 그 다음 Meta 트랜스코딩이 `status_code=ERROR / "Media upload has failed with error code 2207052"`(Meta 쪽 일시 오류)로 죽었다. 재시도 로직이 `postMedia` 안에만 있어서 이 단계는 **한 번 만에 포기**했다. 🔴 **이 에러는 API 응답의 `data.error` 객체가 아니라 `status` 문자열 안에 코드가 들어온다** — 그래서 기존 `isTransientFetch`(error 객체 검사)로는 구조적으로 못 잡는다. 그리고 `ERROR` 는 컨테이너의 **최종 상태**라 같은 컨테이너를 다시 폴링해봐야 소용없고, 반드시 **새 컨테이너**를 만들어야 한다.
    - **수정**: `createFinishedContainer`(생성→FINISHED 대기, 일시 오류면 새 컨테이너로 최대 3회·20/40s 백오프, 시도마다 캐시버스터 salt 변경). 규격 위반(2207004 용량·2207005/2207026 포맷·2207006 길이·2207009 화면비·2207010 해상도)은 **재시도해도 같은 결과라 즉시 실패**시킨다 — 전부 재시도로 두면 못 올라갈 파일에 10분을 쓴다. 코드를 못 읽으면 재시도 쪽. 캐러셀 아이템/부모 컨테이너도 같은 경로로 통일.
    - **🔴 부분 실패를 통째 재실행하면 성공분이 중복 게시된다** — 게시 스텝은 `always()` 라 "5개 중 1개 실패"가 정상 경로인데, 재실행 수단이 `instagram_only` 뿐이라 캐러셀·스토리까지 다시 올라간다. → `workflow_dispatch` 에 **`only` 입력**(예: `-f only=reel,story`) 신설 + 채널 선택을 "게시 대상 채널 결정" 스텝 한 곳으로 모음(`steps.plan.outputs.channels` 를 `,a,b,` 로 패딩해 `contains` 오탐 방지). 기존 `skip_instagram`·`instagram_only` 도 이 스텝이 흡수.
    - **보고 개편**(`src/lib/post-report.ts` + `telegram-social-report.ts`): 게시 스크립트 5개가 채널별 성공/실패를 `generated/instagram/post-report.json` 에 남기고, 텔레그램은 **"총 5개 중 1개 안 올라감"** + 채널별 ✅/❌ + 에러 요약 + **실패분만 재실행하는 명령**을 보낸다. 분모는 워크플로가 넘기는 `HHS_CHANNELS` 기준이라 `only` 재실행 시에도 맞는다. 기록이 아예 없는 채널은 `⏭️ 실행되지 않음`으로 잡아 재실행 목록에 포함. 성공 알림도 같은 스크립트(`telegram:report`)라 실제 게시된 채널만 적는다. 실패 첨부도 **안 올라간 채널의 원본만** 보낸다(종전엔 항상 카드 전량+릴스+스토리).
    - **복구**: `gh workflow run instagram.yml -f only=reel` 로 릴스만 재게시(Media ID `18124568236763878`). 나머지 4스텝 skipped 확인 = 중복 없음.
    - **정리(같은 날)**: ①`skip_instagram`·`instagram_only` **입력 제거** — `only` 하나로 전부 표현된다(인스타만=`carousel,reel,story`, 유튜브·틱톡만=`youtube,tiktok`). 같은 걸 세 가지로 표현하던 것을 하나로 줄였고, 작업53의 재실행 안내도 갱신했다. `only=","` 처럼 유효 채널이 0개면 **아무것도 안 올리고 "성공"으로 끝나므로** 명시적으로 실패시킨다. ②`postMedia`·`waitForFinished` **비공개 전환** — 밖에서 부르면 재시도 없는 경로가 생기고, 그게 이번 버그의 구조 그대로다. 외부에는 `createFinishedContainer`/`publishSingleMedia`만 연다.
    - 테스트 11건 CI 편입(`test:post-report`·`test:instagram-api`): 2207052 재시도 판정, 규격 위반 즉시 실패, 실제 08-02 상황의 보고 문구·재실행 명령.
    - 검증: tsc · ESLint(src 전체) · **테스트 156/156** · 빌드 · 워크플로 YAML 파싱 · plan 스크립트 8케이스 `bash -e` 실측(빈값/단일/복수/오타/`,`/공백) · 라이브 재실행에서 릴스 게시 성공 + 나머지 4스텝 skipped 확인.

77. 🔴 홈 인라인 광고가 첫 렌더에서만 뜨던 문제 (2026-08-03, 커밋 `77b696e4`) — 사용자 신고 "오후 구분선 뒤 광고가 오늘 날짜일 때만 나온다". **날짜 로직 문제가 아니었다.** 노출 조건은 `showMidBanner = prevHour < 12 && currHour >= 12` 로 날짜 무관이고, 실측상 모든 날짜에 오전·오후 경기가 다 있다(8/02~8/08).
    - **원인 = 리마운트.** 인라인 `<ins>` 가 목록 안에 있었는데 그 목록은 `key={list:${selectedDate}|${sport}|...}` 라 날짜·필터가 바뀔 때마다 통째로 리마운트된다. 애드핏 SDK 는 **페이지당 한 번만** 문서를 훑으므로(작업71·`ads-ready.ts`) 새로 태어난 `<ins>` 는 아무도 스캔하지 않고, `AdfitBanner` 의 재스캔 안전망도 `hasFilledAd()`(상단 배너가 채워져 있음)에 걸려 구제하지 못한다. **정확히는 "오늘만"이 아니라 "첫 렌더만"** — 오늘로 되돌아와도 빈칸이다. 기본 선택이 오늘이라 그렇게 보였을 뿐. PC·모바일 공통(구조 문제라 규격 무관).
    - **수정 = 광고를 key 밖 고정 슬롯으로.** 목록을 `amGames`/`pmGames` 두 블록으로 쪼개고 그 사이에 광고를 둔다. 위·아래만 리마운트되고 `<ins>` 는 DOM 에 남는다. **형제 순서도 고정해야 한다** — DOM 위치가 바뀌면 브라우저가 광고 iframe 을 재로드해 중복 노출 소지. 구분선은 오전·오후 둘 다 있을 때만 표시하고, 한쪽만 있는 날엔 광고가 목록 끝(또는 머리)에 붙는다. **감춰 두는 쪽이 오히려 무효 노출이라 정책상 위험**하므로 일부러 그렇게 뒀다.
    - **검증 요령(재사용)**: 헤드리스에서는 SDK 가 광고를 안 채워 "뜨는지"는 못 보지만 **리마운트 여부는 볼 수 있다.** 광고와 목록 안 카드에 각각 `dataset` 표식을 박고 날짜를 8/03→8/04→8/03 로 옮기면, **카드 표식만 사라지고 광고 표식은 남아야** 정상(실측 그대로 나옴). ins 개수 PC 3·모바일 2 중복 없음, 위치는 마지막 오전(10:50)과 첫 오후(15:00) 사이, PC 728 breakout 정상(x=356 = 1440 정중앙), 가로 스크롤 0. tsc·ESLint·build 통과. 실제 채워짐은 사용자가 라이브에서 확인 완료.
    - **남은 관측**: 애드핏 대시보드에서 인라인 유닛(`한해설_PC_인라인`·`한해설_Mobile_인라인`) 노출수가 뛰는지. 그동안 첫 렌더 1회분만 잡히고 있었으므로 수치가 눈에 띄게 올라야 진짜 검증이다.

78. 🔴 스케줄러 무성 실패 3종 + 홈 payload 49.5KB 절감 (2026-08-03) — 전체 코드/워크플로 최종 점검. 라이브 장애는 없었지만 **실패해도 초록으로 끝나는 경로**가 여럿 있었다.
    - **🔴 push 재시도 루프가 소진돼도 스텝이 exit 0 이었다** (`crawl.yml`·`crawl-results.yml`·`crawl-standings.yml`). 루프의 마지막 명령이 `sleep` 이라 종료코드가 0. 편성·결과·순위가 몇 시간째 안 올라가도 Actions 는 계속 초록. `crawl.yml` 은 그 위에 `updated=true` 까지 찍어, **push 도 안 된 SHA 로 Vercel 배포를 6분 기다리다 TIMEOUT** — 실패 원인이 "빌드 실패"로 잘못 보고되는 경로였다. → `pushed` 플래그 + 소진 시 `exit 1`. **버그 버전을 실제로 돌려 exit 0 이 나오는 것, 고친 버전이 exit 1 을 내는 것 둘 다 `bash -e` 로 실증했다.**
    - **재시도가 아예 없던 곳 둘** (`crawl-starters.yml` :47 / `generate-match-insights.yml`). 매시 결과 크롤이 :13·:43 에 돌고 몇 분 걸리므로 겹치는 창이 실재한다. pull 한 번 → push 한 번이라 그 사이에 끼면 그대로 실패. → 같은 재시도 루프로 통일. starters 는 `pull` 을 `add` 앞에서 뒤로 옮겨 **커밋 후 리베이스**(autostash 의존 제거).
    - **🔴 미디어 준비가 실패해도 게시가 돌았다** (인스타 오전·저녁). 게시 스텝 조건이 `always()` 라, 카드/릴스/스토리 생성이나 `insta-media` push 가 깨져도 게시가 진행된다. 그 브랜치엔 **어제 미디어가 그대로 남아 있고** 게시 스크립트는 raw CDN URL 을 보므로 **어제 것을 오늘 다시 올린다.** → push 스텝에 `id: media` 를 주고 조건을 `!cancelled() && steps.media.outcome == 'success'` 로. 게시 채널끼리의 독립성(작업76)은 그대로 유지된다.
    - **텔레그램 `curl -s` 무성 실패 2곳**(`notify-match-insights`·`social-stats`). 400 이어도 exit 0 이라 알림이 안 가도 초록. → 응답 `"ok":true` 검사 + 실패 시 `exit 1`. social-stats 는 4096자 초과 대비 **node 로 문자 단위 자르기**(`cut`/`head` 는 바이트·줄 단위라 한글에서 어긋난다).
    - **최적화 — 홈 초기 payload 369.5KB → 327.1KB (42.4KB, 11.5%)**: `loadScheduleData()` 가 `schedule.json`(46KB)에 `worldcup.json`(104경기·49.5KB)을 합쳐 돌려주는데, 대회가 끝나(~2026-07-20) 홈 기본 뷰엔 한 경기도 안 걸리면서 **편성표 본체보다 큰 무게**가 매 로드마다 실려 나갔다(작업66에서 발견만 하고 미룬 항목). → `page.tsx pruneSchedulesForClient`(오늘 이후만) + `ScheduleClient` 가 과거 날짜를 열 때 `schedule-archive.json` 과 **같은 지연 fetch 로 `/worldcup.json` 을 받는다.** 리그명이 아니라 **날짜로 자르므로** 다음 대회의 미래 경기는 그대로 통과한다. JSON-LD 는 원본에서 만들어 색인 영향 0.
    - **재발 방지 가드 `test:workflow-push`**(CI 편입, `test.yml` `paths` 에 `.github/workflows/**` 추가 — 안 넣으면 워크플로만 고친 커밋에서 가드가 안 돈다). 숫자 재시도 루프(`for i in 1 2 3 4 5; do`)만 대상으로 잡는다 — `for row in $rows; do` 같은 **반복 처리 루프**까지 잡으면 항목별 실패 처리(`auto-publish-draft` 의 `|| tg`)가 오탐된다(실제로 걸려서 좁혔다). 버그를 되돌려 fail 나는 것 실증.
    - **확인만 하고 안 건드린 것**: 8/02 저녁 릴스 실패는 **작업76 이전 워크플로로 돈 마지막 실행**이었고(스텝 이름이 옛것) 원인도 그때 고친 2207052 → 재발 아님. `GH_PAT_SECRETS_WRITE` 는 비어 있지만 틱톡이 refresh token 을 회전시키지 않아 경고만 뜨고 통과(수개월 무사고). `middleware` 가 `?date=` 를 301 로 떼는데 `ScheduleClient` 는 여전히 그 파라미터를 URL 에 쓴다 — 공유 링크에서 날짜가 빠질 뿐 크래시는 없어 이번 스코프 밖.
    - 검증: tsc · ESLint · **테스트 159/159**(신규 3) · 빌드 425 페이지 · 워크플로 13개 YAML 파싱 · 재시도 루프 `bash -e` 동작 실측(성공/pull실패/push실패) · **프로덕션 서버 헤드리스 실측 13항목 전부 통과**(홈에 월드컵 0건, 초기 로드에서 `worldcup.json` 미요청, 과거 날짜 진입 시 지연 fetch 발생 + 결승 `스페인 vs 아르헨티나` 표시, 콘솔 에러 0).
    - **배포 후 라이브 실측**: 홈 HTML **344.3KB → 305.2KB**(39.1KB, 11.4%), `X-Vercel-Cache: PRERENDER` 유지. 라이브 7항목 통과(카드 17개, 애드핏 ins 3개, 가로 스크롤 0, 과거 날짜 지연 fetch 정상, 콘솔 에러 0). **배포 반영에 약 2분** 걸렸다(20초 간격 폴링 4회).

79. 주간 글감 루프 1회전 + 8월 큐 세팅 (2026-08-03) — 작업55·61로 고친 글감 파이프라인이 **실제로 한 바퀴 도는 걸 처음 끝까지 확인**했다.
    - **작업61 요일 수정이 먹었다.** 이슈 #30 의 추천 5개 발행일(8/13 목·8/14 금·8/18 화·8/19 수)을 전수 대조해 전부 정확. 이슈가 계산한 "순차 큐가 8/12 까지 차 있어 8/13 이 첫 빈 슬롯"도 큐를 세어 보니 맞았다.
    - 추천 4개를 `(고정: 날짜)` 로 박고, 예비 큐의 `jeong-hoo-lee-mlb-broadcast-2026` 을 메인으로 승격하며 **예비 쪽 줄은 지웠다**(안 지우면 다음 주에 또 제안된다). 기존 발행글과 가까운 항목(손흥민 8월 vs 7/30 발행분)에는 각도를 가르라는 주석을 큐 줄에 같이 적었다.
    - **월요일 수동 1편 발행**: `/guide/disney-plus-mlb-broadcast-spotv`. 디즈니+ 가 7/27 부터 SPOTV 협약으로 MLB 를 중계하는데 **하루 한 경기**라 대체재가 아니라는 게 요지. 규모는 우리 데이터로 냈다(7일치 MLB 48경기 = SPOTV NOW 42 · SPOTV 4 · Apple TV+ 2, 디즈니+ 는 주 7경기).
      - **🔴 한국어 해설 여부가 어느 보도에도 없다** → 단정하지 않고 "확인 안 됨"으로 썼다. 한해설의 핵심 질문인데 보도자료에 그 줄이 없는 것 자체가 글의 논점이 됐다. SPOTV NOW 요금도 공개 페이지에 없고 집계 블로그 한 곳뿐이라 **아예 안 썼다**(근거 부족).
      - 최근 두 편이 둘 다 `###` 소제목 + 표 1개 구조라, 이 글은 **소제목도 표도 없이 문단으로만** 갔다(`guide-style.md` 의 "찍어낸 느낌" 방지). `lint:guides` 오류 0 경고 0, 본문 1,125자.
    - 검증: 로컬 프로덕션 헤드리스 12항목 + 라이브(NewsArticle JSON-LD · `max-image-preview:large` · 전용 OG 이미지 200 · 목록/사이트맵/RSS 포함 · 자동 내부링크 5개 · 모바일 390px 넘침 0) · IndexNow 160 URL 통지.

80. 🔴 CSS 유실 시 상단 배너 전면 확대 — 에셋 스큐 자가복구 (2026-08-04, 커밋 `dad53dd7`) — 아이폰 사파리 신고 "링크로 들어가거나 탭이 미리 열려 있으면 fadeby 배너가 화면 전체로 확대돼 나오고, 새로고침하면 인트로가 정상 동작". **작업51 에서 SW 루트 SWR 을 폐기했는데도 같은 증상이 남아 있었고, 원인은 SW 가 아니었다.**
    - **원인 = 스타일시트 404.** 브라우저가 옛 HTML 을 들고 있으면 그 HTML 이 가리키는 `/_next/static/css/<contenthash>.css` 가 이미 지워져 404 난다 — **Vercel 은 이전 배포의 정적 파일을 안 남긴다**(라이브에서 옛 해시 요청 시 `404 not-found.txt` 확인). 코드 푸시마다 Tailwind 출력 해시가 바뀌므로(이번 배포도 `84c9735e`→`5deafc36`) 창이 계속 열린다.
    - **왜 하필 배너가 커지나**: `next/image fill` 은 **인라인 스타일**로 `position:absolute; inset:0; width/height:100%` 를 박는다. Tailwind 가 없으면 부모의 `relative h-[136px] overflow-hidden` 이 안 먹어 기준이 뷰포트가 되고, 인트로의 `fixed inset-0` 도 풀려 `static` 으로 아래로 밀린다. 즉 **인트로가 사라진 게 아니라 화면을 못 덮은 것.**
    - **재현법(재사용)**: Playwright 로 `**/_next/static/css/**` 만 404 fulfill 하고 라이브를 로드한다. webkit(iPhone 13)·chromium(Pixel 7) 둘 다 신고 화면 그대로 나온다(`intro=374x5781(static)` · `img=390x664@0` = 전면). **컨텍스트를 새로 만들어야 한다** — 같은 컨텍스트에서 이미 로드했으면 CSS 가 1년 immutable 로 캐시돼 404 가 안 걸린다.
    - **수정**: ①`globals.css` 에 센티널 `:root{--hhs-css:1}` ②`layout.tsx` head 인라인 스크립트가 센티널이 비면 **세션당 1회** `location.reload()` — 스크립트는 앞선 스타일시트 로드를 기다리므로 **첫 페인트 전에** 갈리고 사용자는 깨진 화면을 못 본다. 무한 새로고침 방지로 `sessionStorage` 가드, 스토리지를 못 쓰면(프라이빗) 리로드하지 않는다 ③인트로 오버레이(`fixed/inset/z`)와 배너 컨테이너(`relative/overflow`)에 **클래스와 같은 값을 인라인으로도** 박아, 자가복구가 실패해도 전면 확대가 구조적으로 불가능하게 했다(높이는 sm 브레이크포인트로 갈려서 클래스에만 둔다).
    - **🔴 404 응답도 `document.styleSheets` 에 항목으로 잡힌다** — 개수로는 로드 성공을 판별할 수 없어 CSS 변수를 센티널로 쓴다.
    - 검증(로컬 프로덕션 + 라이브, WebKit iPhone): 정상 `css="1" retry=null img=366x136` / CSS404 지속 `css="" retry=1 img=374x134`(리로드 1회로 멈춤, 폭발 없음) / CSS404 후 복구 `css="1" retry=1 img=366x136`(자가복구). tsc·ESLint·빌드 425 페이지 통과.
    - **남은 미확인**: 사파리가 왜 옛 HTML 을 재사용하는지(HTML 응답은 `max-age=0, must-revalidate`). 탭 폐기 후 복귀 시 캐시 재사용이 유력하나 원격으로 증명 못 했다. 위 수정은 트리거와 무관하게 이 부류를 막는다. **이미 옛 HTML 을 들고 있는 방문자는 그 HTML 에 자가복구 스크립트가 없으므로 한 번은 여전히 깨진다** — 그 뒤 새 HTML 을 받으면 보호된다.

81. 🔴 자매 사이트 인바운드 링크 — 배너가 봇에게 안 보이고 있었다 (2026-08-04, 커밋 `1fa23f92`·`ca41300a`) — 채운 서치콘솔이 3개월째 **색인 0**이었고, 원인을 따라가니 여기였다.
    - **채운 쪽 기술 SEO 는 멀쩡했다**(200 · `index, follow` · canonical 자기참조 · 사이트맵 28쪽 · 본문 서버 렌더 · 고아 0). 실제 상태는 12쪽 전부 "발견됨 – 현재 색인이 생성되지 않음" + **최종 크롤링 "해당사항 없음"** — URL 목록만 받고 한 번도 가져가지 않은 상태였다. 신규 서브도메인에 **외부 인바운드 링크가 0**이면 구글은 크롤 예산을 안 쓴다.
    - **🔴 좌측 `ChaeunSideBanner` 는 검색봇에게 존재하지 않는다.** `SideBanners` 가 `"use client"` + `useAdsReady()` 게이트라 조건이 맞기 전엔 `null` 을 내서 **서버 HTML 에 `<a href>` 가 아예 안 실린다.** 게다가 `hidden xl:flex`(≥1280px)라 **모바일 우선 색인**을 하는 구글에는 렌더 후에도 `display:none`. 실측: `curl https://haeseol.com/ | grep -c chaeun` = **0**. 작업60·65 로 공들인 배너가 사람 눈에만 보이고 있었다.
    - **수정**: `SiteFooter.tsx`(서버 컴포넌트, 전 페이지 1,826쪽, 전 화면폭)에 채운·fadeby 텍스트 링크. **🔴 그 줄을 지우면 두 사이트의 발견 경로가 다시 0이 된다** — 배너를 손보더라도 링크는 남길 것.
    - **교훈**: 홍보 배너와 SEO 링크는 다른 물건이다. 배너는 보이면 되고, 링크는 **서버 HTML 에 있고 모바일에서 안 숨겨져야** 한다. 자매 사이트를 새로 붙일 때 이것부터 본다.
    - 같은 날 채운·fadeby 쪽 작업(착지 페이지·IndexNow·RSS·GA4)은 각 레포 `CLAUDE.md` 참조.
    - **🔴 상단 fadeby 배너(작업50)의 href 가 구 도메인 `fadeby.vercel.app` 이었다** — 그 주소는 리다이렉트 없이 같은 사이트를 200 으로 서빙하고 있어서, 한해설에서 **가장 눈에 띄는 자리의 링크 가치가 정작 키우려는 도메인에 안 쌓이고 있었다.** `fadeby.haeseol.com` 으로 교체(커밋 `a4a31433`). fadeby 쪽에도 옛 호스트 308 리다이렉트를 걸었지만, **링크는 처음부터 최종 주소를 가리켜야 한다**(리다이렉트를 한 번 타면 그만큼 샌다). 자매 사이트 도메인이 바뀌면 이 배너부터 볼 것.
    - **GA4 ↔ 서치콘솔 연결 시 주의**: 한해설은 **`https://haeseol.com/` URL 프리픽스** 속성을 골라야 한다. `haeseol.com` **도메인** 속성은 서브도메인을 전부 포함해서 채운·fadeby 검색어가 한해설 리포트에 섞인다(www 는 non-www 로 307 리다이렉트라 대상이 아니다).

82. 🔴 쇼츠 피드 배포 중단 → 아침·저녁 게시물 중복 제거 + 후킹 문구 (2026-08-05, 커밋 `4cf96a15`) — "어제 올린 것만 조회수가 한 자리"라는 신고. 채널 RSS 로 시계열을 뜨니 **절벽이 2026-08-04 19:04 KST 업로드부터** 정확히 시작(8/03 저녁 501 · 8/04 아침 145 → **8/04 저녁 4 · 8/05 아침 0**).
    - **우리 코드 결함이 아니었다.** Data API 로 정상분과 전수 비교: `privacyStatus: public` · `uploadStatus: processed` · `madeForKids: false` · `contentRating: {}` · 태그 · 카테고리 · 커스텀썸네일 전부 동일, `/shorts/<id>` 200(리다이렉트 없음 = 쇼츠 판정 정상), 업로드·댓글 로그 정상, 소셜 파이프라인 마지막 코드 변경은 8/03 인데 그날 저녁분은 501 이 나왔다. 채널 위반·제한도 없음.
    - **🔴 Studio "노출수"로 판단하면 안 된다** — 노출수는 검색·탐색 썸네일만 세고 **Shorts 피드는 안 센다**. 정상분이 노출 112 / 조회 503 인 이유가 이것. 결정적 화면은 **동영상 분석 → 분류 `트래픽 소스`, 기간 `게시 이후`**(기본 28일은 어제·오늘이 범위 밖이라 전부 `—` 로 나온다 — 데이터가 없는 게 아니다). 결과: 8/04 저녁분 합계 6 중 **Shorts 피드 3**, 채널 페이지 3, 검색 0. 정상분은 피드에서만 400+. **유튜브가 피드 배포를 껐다.**
    - **원인 = 저녁·다음날 아침이 같은 게시물이었다.** 저녁은 "내일 경기", 다음날 아침은 "오늘 경기"라 **대상 날짜가 같다**(evening 8/4 → 8/5, morning 8/5 → 8/5). 제목이 `getMainHighlight(today)` 하나로 만들어져 둘 다 `이정후 MLB 한국어 중계 ⚾ 8/5(수) #Shorts` 로 **글자까지 동일**했고, `pickHookImage(today)` 도 날짜만 키로 써서 **커버 배경 이미지가 같았다**. 몇 달 누적(181개)하다 임계를 넘은 것으로 본다. 종전 "morning=legacy / evening=v2 라 차별화돼 있다"는 인식은 **영상 만드는 방식**만의 얘기였다.
    - **수정(사용자가 감축 대신 차별화를 선택)**: `src/lib/post-slot.ts`(대상 날짜로 아침/저녁 판정 + 날짜 기반 문구 순환, **저녁은 2칸 밀기** — 1칸만 미니 형태가 비슷한 문장이 짝지어지는 날이 실측으로 나왔다) · `src/lib/shorts-title.ts`(슬롯별 후킹 제목·설명 첫 줄, 선수면 "출격/나옵니다"·매치업이면 "시작/열립니다", 검색 키워드는 문장 안에 유지, 100자 상한) · `pickHookImage(today, slot)`(배경 이미지 분리, 우연히 같은 칸이면 한 칸 밀기) · `reel-title-card`(첫 프레임 문구도 슬롯별 풀) · `instagram-api`(캡션 첫 줄 후킹).
    - **가드 `test:shorts-title` 7건 CI 편입** — 아침·저녁 제목이 같아지면 실패. 길이·`#Shorts`·날짜·키워드 유지도 검사.
    - 검증: tsc · ESLint · 신규 7건 + 인스타/틱톡 스위트 · 빌드 425 페이지 · **첫 프레임 카드 2종 실제 렌더**(배경·문구 모두 다름, 레이아웃 정상) · CI success. **사이트 화면 변화 0**(바뀐 라이브러리는 전부 게시 스크립트 전용, `src/app` 참조 0건).
    - **관찰**: 이미 눌린 건 바로 안 풀린다. 1~2주 뒤 Shorts 피드 조회가 돌아오는지 보고, 안 되면 하루 1회 감축(`instagram-morning.yml` 의 `ALL=` 에서 `youtube` 제거 — 저녁이 아침보다 2~5배 잘 나온다).

83. 🔴 히어로 선정 개편 + 커버 후킹 도입 (2026-08-05, 커밋 `16020a36`) — "커버에 후킹이 필요하다"는 요청에서 시작했는데 코드를 뜯어보니 결함이 두 층이었다.
    - **🔴 L1 — `BIG_TEAMS` 가 리그별 맵이라 리그명이 안 맞으면 팀 점수가 0이 된다.** 실측: `팀 K리그 vs 맨시티`(쿠팡플레이 시리즈 19:00) **20점 = 롯데 vs 키움과 동점, 후보 16위**. `BIG_TEAMS.프리미어리그` 에 맨시티가 있어도 이 경기 리그는 `쿠팡플레이 시리즈` 라 조회 자체가 안 됐다. 첼시·유벤투스·밀란도 같은 이유로 0점. **리그가 아니라 팀이 값어치인 경기가 실재한다.** 거기에 `koreanPlayer` 30 이 단일 최대 가중치라 평일엔 MLB 코리안리거가 상시 1위였다.
    - **수정**: `GLOBAL_BIG_CLUBS`(리그 무관 팀명 매칭, 둘 다 20 / 한쪽 12, 리그 기반 점수와 `Math.max` — 중복 가산 금지) · `EVENT_LEAGUE_TIER`(`쿠팡플레이 시리즈` 15 · `클럽 친선경기`·`카라바오컵` 10) · `koreanPlayer` **30→18** · `homeEvent` +10(내한경기에 빅클럽이 끼면) · `repeatPenalty` −12(직전 2일 히어로 팀) · `norm()` 공백 제거(데이터는 `AT. 마드리드`, 상수는 `AT.마드리드` 였다).
    - **🔴 글로벌 빅클럽 세트만 넣으면 효과가 0이다.** 이벤트 등급까지 같이 넣고 `koreanPlayer` 를 30 으로 두면 7일 시뮬레이션 결과가 현행과 **완전히 동일**했다. 실제로 작동한 레버는 코리안 가중치 하향뿐이고 나머지는 보조다. **가중치는 눈대중 금지 — 7일 시뮬레이션을 돌려서 볼 것.** MLB·KBO·NBA 팀은 `GLOBAL_BIG_CLUBS` 에 **넣지 않는다**(이미 리그 스코프로 받고 있어 중복 가산하면 코리안리거가 다시 부푼다).
    - 결과: 7일 다양성 **6/7 → 7/7**(8/05 팀 K리그 vs 맨시티 · 8/08 첼시 vs AC 밀란 · 8/09 맨시티 vs AT. 마드리드). 코리안리거는 4/7 로 남는다.
    - **연속 방지 데이터 출처**: `schedule.json` 은 오늘부터 7일치라 어제가 없다. 과거 히어로는 `public/schedule-archive.json`(2026-05-19~)에서 읽는다. `recentHeroTeams()` 안에서는 감점을 안 건다 — 또 과거를 보면 재귀가 안 끝난다.
    - **L2 — 커버 후킹 `src/lib/cover-hook.ts` 신설**. 슬롯당 문구 풀 **8개**(3~4개면 같은 틀이 사나흘마다 돌아온다). 틀은 사람이 쓰고 코드가 값만 채운다 — LLM 생성은 안 쓴다(봇처럼 보이게 만든 원인은 틀 반복이 아니라 작업82 의 "글자까지 동일"이었다). `when` 조건으로 시간대·요일 안 맞는 문구는 후보에서 뺀다(`퇴근하고`=저녁 경기, `오늘 밤 지나면`=새벽 경기, `평일에`=평일).
    - **🔴 두 슬롯은 구도부터 다르다**(커밋 `6e38ae58` 로 최종 확정) — 아침 = **사진 66% + 하단 솔리드 블록**(`#0b0d12`, 경계에 앰버 라인, 블록 안 좌측 정렬·세로 중앙) / 저녁 = **풀블리드 + vignette**(경계선 없음, 중앙 정렬). 여기에 액센트 색(앰버 `#ffb02e` / 라임 `#8fff3d`) · 문구 순서(작은줄→큰줄 / 큰줄→설명줄) · 배경 사진 · 영상 경로(v1/v2)가 얹힌다. **`HHS_LEGACY_MORNING` 의 뜻이 바뀌었다**: "V7 카드를 쓰는가" → "릴스 v1 첫 프레임용 9:16 을 하나 더 만드는가". `renderHookV7` 은 파일에 남아 있으나 게시 경로에서 빠졌다.
    - **🔴 두 슬롯을 가르는 축은 "구도" 하나뿐이다.** 같은 날짜·같은 히어로를 대상으로 하는 쌍이라 구분이 어렵다. 하루에 걸쳐 네 번 시도해 얻은 결론: ①**색만**(앰버/라임)은 썸네일 크기에서 안 읽힌다 ②**여백 조정은 역효과** — 아침을 28px 올렸더니 세로 위치가 저녁 구간(928/1055/1125)으로 들어가 **더 닮아졌다**(한 문제를 고치다 다른 걸 깎아먹음) ③**정렬만**(좌측/중앙)은 골격이 그대로라 "텍스트만 바뀐" 느낌 ④**구도**(분할/풀블리드)만 작동한다. **반투명 패널안은 실패** — 사진이 비쳐 저녁 vignette 와 구분이 안 되고, 경계를 흐리는 순간 갈리는 축 자체가 사라진다. 원래 V7(좌패널)이 그 구조 차이 역할을 하고 있었는데 후킹이 안 들어가서 걷어냈다가 같은 문제를 다시 만난 것이다 — **구조를 없앨 때는 그게 뭘 하고 있었는지 먼저 볼 것.**
    - 날짜·요일을 흰색으로. **강조가 둘이면 시선이 갈려 어느 쪽도 안 읽힌다.** 줄바꿈은 **어절 단위** — 강조 조각 기준으로 자르면 `맨시티가` 가 `맨시티 / 가` 로 갈린다.
    - **🔴 조사는 `src/lib/josa.ts` 를 쓸 것.** `${who}는` 을 고정했다가 `김혜성는 SPOTV NOW` 가 나왔다(작업58 `아스날는` 과 같은 부류). 그 파일이 이미 있는데 안 쓰고 있었다. **조사 검사를 생성 문장 정규식으로 하면 안 된다** — `쿠팡플레이` 처럼 고유명사가 이/가/은/는 으로 끝나는 경우가 흔해 조사와 구분이 안 된다(실제로 `쿠팡플레이`의 `이`를 조사로 잡아 오탐). 템플릿을 직접 호출해 받침 있는/없는 이름을 넣어 검사한다.
    - **쇼츠 제목 풀 4→8**, `hookContext` 가 `coverHookContext` 를 재사용해 커버와 제목의 주인공을 하나로 맞췄다(종전엔 `pickHeroMatch` 를 직접 불러 연속 방지가 안 걸렸다). **풀 크기는 생성 결과로 셀 수 없다** — 팀명·시각이 매일 달라 풀이 4개여도 문자열은 다 다르게 나온다. 풀 배열을 export 해 길이를 검사한다.
    - **영상까지 전부 반영됨**(실제로 5종 생성 후 첫 프레임 육안 확인): 아침 릴스 v1(12.0s) · 저녁 릴스 v2(15.6s) · 틱톡 변형(`noUrl`, `한해설` 한글 브랜드 유지) · 캐러셀 1장 · 스토리. 부수 개선 — 아침 릴스 첫 프레임이 4:5→9:16 이 되며 **위아래 검은 띠가 없어졌다.**
    - 새 가드 `test:cover-hook` 6건 CI 편입(같은 날 아침·저녁 문구가 같아지면 실패 = 작업82 재발 방지). 검증: tsc · ESLint · **테스트 173건 fail 0** · 빌드 434페이지 · CI success.
    - **커밋 순서**: `16020a36`(구현) → `50341309`(문서) → `b3941261`(아침 여백 — 이 시도가 위 ②) → `6e38ae58`(구도 분리, 최종). `b3941261` 의 `LIFT` 는 아침이 새 경로로 빠지며 저녁 전용이 돼 제거됐다.
    - **관찰**: ①오늘 저녁 워크플로가 첫 실전 — 텔레그램 보고에서 5채널 전부 ✅ 인지 ②히어로가 유럽 빅클럽로 옮겨가 `이정후 한국어 중계` 류 검색 유입이 주는지(2~4주, `social-stats`) ③**작업82 쇼츠 피드 회복 여부가 이 변경과 섞였다** — 회복돼도 둘 중 뭐가 먹었는지 못 가른다. 안 되면 다음 레버는 영상 독창성(TTS·실사컷). 상세 [[project-hero-cover-hook]].

84. 🔴 조회수 하락 조사 → 중복 축 하나 더 + 유튜브 스텝 오판정 (2026-08-07, 커밋 `955a683f`) — "유튜브도 인스타도 조회수가 낮아졌다"는 신고로 실측. 채널 RSS·Data API·워크플로 로그.
    - **수치**: 게시일 기준 하루 합계가 8/01 정점 1621 → 8/04 463 · 8/05 123 · 8/06 325. **8/04~8/06 하루 평균 304 = 직전 주(775)의 40%.** 다만 7/29 에 95 인 날도 있어 사상 최저 밴드는 아니다.
    - **🔴 작업82 기록 정정 — "8/04 저녁 4회"는 미성숙 영상을 잰 값이었다.** 지금 **321회**다. 실제로 죽은 채 남은 건 **8/05 아침 2회** 하나뿐이고, 그게 직전 저녁분과 글자까지 같은 제목이던 마지막 중복분이다. 중복 억제는 실재했지만 범위가 훨씬 좁았다. **하루 지난 조회수로 배포 차단을 단정하지 말 것.**
    - **🔴 중복 축이 하나 더 있었다 — 게시면.** 작업82 에서 슬롯(아침/저녁)만 갈랐고, **같은 실행 안에서** 나가는 인스타 캐러셀·릴스가 링크 UTM 만 빼고 글자까지 같은 캡션이었다(실측 `[REELS] 오늘 KIA 경기 …` = `[FEED] 오늘 KIA 경기 …`). 둘 다 `buildCaption(mm,dd,today,link)` 한 함수에 링크만 달랐다. **중복은 슬롯 × 게시면 두 축이다.**
      - `buildHookLine(today, slot, surface)` — surface = `youtube-desc`/`ig-feed`/`ig-reel`, 풀에서 다른 칸을 집는다. 한 실행의 네 텍스트(제목·유튜브설명·캐러셀·릴스)가 전부 다르다.
      - 첫 줄만이 아니라 **본문 구조**를 갈랐다: 캐러셀 = 편성표 전체(주요 3경기 + 총 경기 수) / 릴스 = 히어로 한 경기 집중. 같은 텍스트 두 번이 아니라 실제로 다른 게시물이 된다.
      - 해시태그 줄은 **순서 회전**(태그를 빼면 도달을 잃는다). 🔴 고정 상수로 나누면 몫이 0 되는 길이가 생긴다 — 태그 3개에 shift 3 이면 회전이 안 된다(가드에 걸렸다). 길이 비례로.
      - **폴백도 슬롯 × 게시면으로 갈랐다.** 종전엔 문장 하나라, 편성이 안 잡힌 날 여섯 게시물이 전부 같은 첫 줄이었다 — 정작 중복이 제일 위험한 날이다.
      - **🔴 릴스 캡션 자기모순** — 후킹 주인공은 `pickHeroForDate`(연속 방지 감점 적용)가 고르는데 경기 목록은 `pickHeroMatchesTop`(감점 없음) 순서라 둘이 갈린다. 실측: 후킹 "이정후" ↔ 목록 첫 줄 "다저스". 캐러셀은 3줄이라 섞여 안 보이던 게 릴스 1줄에선 그대로 드러났다(**3줄→1줄로 줄이면서 내가 만든 결함**). 히어로 경기를 직접 집도록 수정.
    - **🔴 유튜브 — 업로드 성공 뒤 실패가 스텝을 죽였다.** 8/07 아침 실행이 `failure` 인데 영상은 정상 공개돼 있었다. 로그: `✅ 유튜브 쇼츠 업로드 완료` 직후 `❌ 썸네일 업로드 실패: 403 "The thumbnail can't be set for the specified video."` 하나로 `exit 1`. 직전 6회는 전부 `✅ 썸네일 설정 완료` 라 일시 오류다. **그 빨간 걸 보고 재실행하면 같은 영상이 한 번 더 올라간다** — 작업53 에서 인스타 댓글에 이미 내린 결정과 같은 구조인데 유튜브만 빠져 있었다. 썸네일·댓글을 5s/15s 재시도 후 **비치명** 처리. **게시 완료 뒤 부가 작업은 절대 throw 하지 않는다.**
    - **아침 cron `0 20` → `53 19`(정시 회피).** `0 20` 이던 동안 게시가 05:47~06:08 로 안정적이다가 8/07 에 **4시간 50분** 밀려 09:54 에 나갔다("오늘 경기"인데 오전 10시). GH Actions 무료 티어는 정각 큐가 가장 붐빈다 — 저녁 워크플로는 같은 이유로 이미 `18 7` 을 쓰고 그 주석에 지연 실측이 적혀 있었다.
    - **히어로 `koreanPlayer` 18 → 26.** 작업83 에서 18 로 내린 근거는 **다양성**이었고 조회수 근거가 없었다. 히어로가 코리안리거를 벗어난 첫 두 편(8/06 저녁·8/07 아침, 둘 다 KIA)이 27·6 회로 최근 최저고, 상위 기록은 전부 코리안리거 MLB(1156·1000·878·749). 다양성은 이제 `repeatPenalty` 가 따로 맡는다. **7일 시뮬레이션으로 값을 골랐다** — 30 은 8/09 맨시티 내한까지 MLB 에 밀려 손해. **표본 2편이라 확정이 아닌 관찰 중인 가설이고, 되돌리기는 상수 한 줄.**
    - **🔴 인스타 조회수는 우리가 못 본다** — `(#10) Application does not have permission for this action`. `instagram_manage_insights` 가 없어 좋아요·댓글만 나온다. 팔로워 **4** · 게시물 **186**(작업57 시점 3명/150개). 조회수를 보려면 사용자가 Meta 앱 권한을 승인해야 한다.
    - **🔴 테스트 날짜 하드코딩을 걷어냈다.** `schedule.json` 이 오늘부터 7일치라, 박아 둔 `DATES = ["2026-08-05", …]` 가 과거가 되는 순간 `hookContext()` 가 전부 null 을 돌려주고 **폴백 경로만 조용히 검사**하고 있었다. 실패도 안 해서 죽은 줄 모른다. 실제로 그 상태였고, 그 뒤에 위의 폴백 미분리 결함이 숨어 있었다.
    - 새 가드 3건(전부 CI): 같은 실행의 게시면별 후킹이 모두 다른지 · 캐러셀·릴스 캡션이 전체/첫 줄/해시태그 줄 어디도 안 겹치는지 · 릴스 주목 경기가 후킹 주인공과 같은 경기인지. **셋 다 작성 즉시 실제 결함을 잡았다**(폴백 미분리, 태그 회전 몫 0).
    - 검증: tsc · ESLint · **테스트 177/177** · 빌드 · 캡션 4종 실제 렌더 비교 · CI success.
    - **관찰**: ①내일 아침·저녁이 첫 실전 — 텔레그램 보고 5채널 ✅ 확인 ②1~2주 뒤 조회수 회복 여부. **🔴 작업82·83·84 변경이 전부 섞여 있어 회복돼도 무엇이 먹었는지 못 가른다.** 다음 레버는 영상 독창성(TTS·실사컷) 또는 하루 1회 감축.

### 다음 작업 (예정)
- **후원 버튼 — 라이브 가동 중**(작업67·73). Vercel 환경변수 주입 완료(라이브 홈에 배너 렌더 확인). 변수는 `NEXT_PUBLIC_DONATE_BANK`·`_ACCOUNT`(필수) / `_HOLDER`(선택) / 카카오페이는 **티어별 `_KAKAOPAY_1900`·`_4900`·`_9900`**(`_URL`+`_AMOUNT` 쌍은 폐기, 작업68). 값 바꾸면 **재배포 필요**(`NEXT_PUBLIC_*` 는 빌드시 인라인). ~~남은 것: 채운에 같은 컴포넌트 이식~~ **완료(2026-07-31, 작업75)** — 두 사이트가 **같은 계좌·같은 카카오 링크 3개**를 쓰므로 계좌를 바꾸면 **양쪽 Vercel 환경변수를 다 고쳐야 한다.**
- ~~**홈 payload에서 worldcup.json 50KB 트리밍 (작업66 발견)**~~ **완료(2026-08-03, 작업78)** — 369.5KB → 327.1KB. 오늘 이후만 클라로 보내고, 과거 날짜를 열 때 `/worldcup.json` 을 지연 fetch 한다.
- **팀명 alias 미스매치 재점검 (유럽 개막 2026-08~)** — 2026-07-23 LAFC 3-1 솔트레이크 스코어가 안 뜨던 버그(네이버 `솔트 레이크`↔스케줄 `레알 솔트레이크`/`솔트레이크` alias 다리 없음, 마이애미·신시내티도 동일) 수정 후, 오프시즌 리그(EPL·라리가·세리에A·리그1·분데스 등)는 스케줄에 경기가 없어 **오프라인 검증 불가**로 남김. 유효 검증은 스케줄↔결과 실표기 대조뿐(alias 키 vs 결과 primary 비교는 무효 — primary는 매핑 후 값이라 네이버 원본표기 모름). **개막 후 `npm run crawl && npm run crawl:results && npm run audit:aliases` 실행** → `MISS>0` 나오는 리그만 `team-name-aliases.ts`에 네이버 표기 키 보정. 감사 스크립트 = `src/scripts/audit-aliases.ts`.
- 🔴 **네이버·GSC 지표 재확인 (2026-08 중순)** — 2026-07-20 + **07-28(작업62)** 조치들의 효과 판정. searchadvisor.naver.com → 리포트. 볼 것: ①사이트 진단 색인 수(880 기준) ②해설 쿼리 노출(407 기준) ③`/team/`·`/commentary` 노출 발생 여부 ④매치 페이지 디스커버 노출(작업62에서 `max-image-preview:large` 복구됨 — 그전엔 91%가 후보에서 빠져 있었으니 **여기가 가장 큰 변화 지점**). **사용자만 뽑을 수 있음(스크린샷이면 충분).**
- 🔴 **소셜 조회수 회복 관찰 (작업82·83·84)** — 세 번에 걸쳐 중복 신호를 걷어냈다: 슬롯별 제목·커버(82) → 커버 구도 분리(83) → 게시면별 캡션 + 히어로 가중치 + cron(84). **변경이 전부 섞여 있어 회복돼도 무엇이 먹었는지 못 가른다.** 1~2주 뒤 볼 것: ①게시일 하루 합계가 8/04~8/06 평균 304 에서 오르는지(직전 주 775 가 기준) ②히어로가 코리안리거가 아닌 날의 조회수 — 이게 계속 낮으면 `koreanPlayer` 를 더 올린다. 안 풀리면 다음 레버는 **영상 독창성**(TTS 보이스오버·AI컷→실사) 또는 **하루 1회 감축**(`instagram-morning.yml` 의 `ALL=` 에서 `youtube` 제거 — 저녁이 아침보다 2~5배 잘 나온다).
- **작업84 첫 실전 확인** — 다음 아침·저녁 워크플로. 텔레그램 보고에서 5채널(캐러셀·릴스·스토리·유튜브·틱톡) 전부 ✅ 인지 + **아침 게시 시각이 06시대로 돌아왔는지**(cron `53 19` 로 옮김). 실패분만 재실행 = `gh workflow run instagram.yml -f only=<채널>`.
- **인스타 조회수 측정 — 사용자 승인 필요** — `instagram_manage_insights` 권한이 없어 `social-stats` 가 좋아요·댓글만 뽑는다(`(#10) Application does not have permission`). 하루 4개씩 186개를 올리면서 조회수를 한 번도 못 봤다. Meta 앱에서 권한 추가·재승인이 필요하고, 그전까지 인스타 판단은 팔로워(4)·좋아요(0~1)뿐이다.
- **팀 페이지 색인 추적(2~3주)** — 2026-07-20 배포. GSC에서 `/team/` 노출이 잡히기 시작하는지. 잡히면 다음 확장(선수 페이지·리그 페이지 재정렬)의 근거가 됨. 안 잡히면 매치 페이지와 같은 실패라 원인 재진단 필요. **단, 07-20 시점엔 진입 경로가 홈·매치뿐이고 정식 팀명도 없었고 IndexNow 통지도 안 됐음 → 작업62(07-28)에서 순위표 링크 69개·정식명·IndexNow 가 붙었으니 사실상 여기가 진짜 출발선.**
- **원본 데이터 발표 (GEO 최우선 코드 레버)** — "플랫폼별 한국어 해설 비율" 월간 집계. 10개 플랫폼의 해설 여부를 매일 수집하는 곳은 우리뿐이라 **다른 데 없는 원본 데이터**이고, AI 인용·백링크 둘 다 유발한다. 데이터는 이미 `results`·`schedule`에 다 있음. 상세 `docs/geo-analysis.md`.
- **선수 페이지 (2026-08 이후)** — 지금은 데이터가 없어서 보류(작업58 참조). EPL·분데스 개막(8/22)으로 유럽 팀 페이지가 생기면 코리안리거 허브(이정후→샌프란시스코, 손흥민→LAFC, 이강인→아틀레티코, 김민재→뮌헨)부터 검토.
- **뉴스잭(작업55 후속, 보류)** — 다이제스트를 30~60분 주기로 돌려 감시 키워드 급증 시 텔레그램 + `draft/*` PR 자동 생성. 인프라(`auto-publish-draft.yml` 빌드게이트)는 이미 있고 트리거만 추가하면 됨. **글감 질 1~2주 관찰 후 판단.**
- **PWA 흰 번쩍 — 근본 원인 해결됨(작업51, 7/15).** 홈이 동적 렌더라 CDN 캐시가 꺼져 있던 게 원인이었고 `revalidate=60` 정적화로 엣지 즉시 서빙. SWR은 폐기(재도입 금지). **남은 확인**: 사용자 폰에서 앱 닫았다 열기 1~2회(옛 SW 교체) 후 번쩍 체감 확인. 그래도 남으면 iOS 런치스크린→웹뷰 핸드오프(OS레벨, 웹 제어 불가).
- **경기 찜 푸시 알림** — 사용자 명확 요구: "⭐찜한 경기 득점 시 폰 꺼져있어도(화면off/앱닫힘) 알림"(카톡처럼). **저장소 Upstash→Vercel Blob로 변경**(별도 가입 최소화). **A단계 코드 작성됨**: `src/lib/push/store.ts`(Blob access:private, 구독1건=파일1건), `send.ts`(web-push VAPID), `/api/push/subscribe`·`/test`, `PushSubscribeButton`(푸터, VAPID 미설정시 자동숨김=현재상태). 레포 public이라 GH Actions 골 폴러 $0. **선행(사용자 셋업, 미완): ①`npx web-push generate-vapid-keys` ②Vercel 대시보드 Blob 스토어 생성(BLOB_READ_WRITE_TOKEN 자동주입) ③Vercel 시크릿 4개(NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT/PUSH_TEST_KEY).** 셋업 후 남은빌드 B(⭐찜UI=경기카드 별버튼+follows 저장)→C(시작·결과 발송 GH Actions)→D(실시간 골폴러, 득점후 30~60초·완전실시간은 무료론 불가). 플랫폼: 아이폰=설치필수, 안드/PC=설치없이 🔔버튼만. 상세 [[project_live_lineup_features]].
- **하이라이트 KBO 첫 실전 확인** — 작업48 가동됨. 저녁 KBO 종료 후 티빙 채널 매핑으로 자동 채워지는지 확인. 채움율 낮으면 maxResults 5→10 완화 검토.
- ~~애드핏 매체 심사~~ **완료(2026-07-30, 작업64)** — 상단 10페이지 + 홈 인라인 라이브 송출 확인. 유닛 4개: `한해설_PC`(728x90)·`한해설_Mobile`(320x50)·`한해설_PC_인라인`(300x250)·`한해설_Mobile_인라인`(300x250), 전부 `src/app/_components/AdfitBanner.tsx` 한 곳. 배치는 편성표 목록 끝 + 오후 경기 구분선 아래(홈 상단 아님 — CLS·제5.3조 회피). 정산: 최소 지급액 5만원, 매달 지정일 확정 적립금 전환.
  - **잔여 확인**: 실제 노출·수익 발생 여부는 대시보드 보고서에서 며칠 지켜볼 것(신규 슬롯이라 채움율 낮을 수 있음).
- **수익화 대기 1건 — 🔴 마운트 지점부터 새로 필요**: 2026-07-30(작업65)에 우측 사이드 쿠팡 카드가 애드핏로 교체되며 쿠팡 UI가 사이트에서 완전히 빠졌다. `coupang-products.json`은 데이터만 남아 있고 어떤 컴포넌트도 안 읽는다. 재개하려면 사용자가 와우멤버십 링크 가능여부+스포츠 상품 링크 ~20개를 주는 것과 별개로 **어디에 다시 넣을지부터 정해야 함**(예전처럼 사이드는 이제 애드핏 자리라 다른 위치 필요). 링크프라이스는 티빙 없어 접음, 재조사 금지 — auto-memory `hhs-monetization-findings`.
- kicktalk 추가 후보(우선순위): 승부예측+포인트(localStorage 시작=셋업0) > ~~PWA~~(완료) > ~~팀 상세~~(완료, 작업58) > MVP투표 > 경기별 댓글(가벼운 UGC). 자유게시판 풀버전은 모더레이션 부담으로 제외. (하이라이트는 위 별도 항목으로 진행 중)
- (상시 운영) 매주 월 글감 이슈 도착 → 큐 세팅. 이제 이슈가 **추천 5개를 발행일까지 붙여** 내므로 사람은 승인만 하면 된다(작업55). 월요일 1편은 즉시 수동 발행, 화~금 4편은 **완전 자동(머지 불필요, 작업39)**. 절차는 작업79에 실제로 돈 한 바퀴가 적혀 있다. 특정 경기 결과·감상글은 여전히 사람 수동.
  - **현재 큐(2026-08-03 기준)**: 8/04 EPL 개막 · 8/05 김민재 분데스 · 8/06 이강인 데뷔전 · 8/07(고정) 쿠팡 8월 · 8/11 스포티비→쿠팡 · 8/12 PSG UCL · **8/13·8/14·8/18·8/19 는 이슈 #30 추천으로 고정 완료**. 8/20 이후가 비므로 다음 주 이슈에서 채울 것. ~~월드컵 라운드 편성글 자동화(작업45)~~ 대회 종료로 2026-07-30 제거(작업66) — `worldcup-round-article.yml`·`gen:worldcup-round` 삭제
- 틱톡 0조회수 — 캡션 스팸 신호 제거(작업54, 7/19) 후 1~2주 추이 관찰. **사용자 확인 필요: 앱에서 설정→계정 상태 + 각 영상 "추천 부적격" 표시 → 있으면 이의신청.** 안 풀리면 다음 레버 = 영상 독창성(TTS 보이스오버, AI컷→실사), inbox 수동게시 실험. 계정 warmup은 사람 몫
- (운영 메모) 핵심 미해결은 기술 아닌 **트래픽/수익화** — AdSense·애드핏 다 트래픽 미달이 병목(일 ~110명)

## 세션 운영 규칙 (Windows)

이 레포는 Windows 에서 작업한다. **터미널 창이 자꾸 뜨고 "백그라운드 셸 실패" 알림이 반복되는 것**을
막기 위한 규칙이다.

- **개발 서버를 백그라운드로 띄우지 말 것.** `run_in_background: true` 로 `next dev` 를 올리면
  세션 내내 살아 있으면서 재컴파일마다 콘솔 창을 띄우고, 종료할 때 "실패"로 보고된다.
  UI 확인이 필요하면 **확인이 필요한 그 순간에만** 띄우고 **바로 내린다**.
- **`Start-Process` 로 창·브라우저를 열지 말 것.** 사용자에게 보여줄 게 있으면 경로/URL 을 말로 준다.
- 오래 걸리는 명령은 `timeout` 을 명시한다. 기본 타임아웃(120초)을 넘기면 harness 가 자동으로
  백그라운드로 돌려 같은 알림이 뜬다. `.claude/settings.json` 에서 기본 300초 / 최대 600초로
  올려 뒀다(레포에 커밋 — 다른 PC 에서도 적용).
- 임시 산출물은 반드시 스크래치패드에. 바탕화면·레포에 파일을 흘리지 않는다.

## 개발 명령어

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버
npm run lint     # ESLint 검사
npm run crawl    # 크롤링 실행 (7일치)
npm run crawl:results    # 결과·스코어 재크롤
npm run test:fetch-cache # 🔴 Next 런타임 fetch 캐시 가드 (CI에서도 돎)
npm run test:starters / test:highlights / test:tiktok-caption
npm run test:shorts-title    # 🔴 아침·저녁 쇼츠 제목이 같아지면 실패(피드 배포 중단 재발 방지)
npm run test:cover-hook      # 🔴 아침·저녁 커버 문구가 같아지면 실패 + 조사 고정 금지(josa.ts 사용 강제)
npm run test:idea-dupes / test:naver-news
npm run test:robots-meta # 🔴 색인 지시자 가드. `robots: cond ? undefined : {}` 금지(layout robots를 삭제함)
npm run test:seo-meta / test:team-full-names / test:team-links  # description 상한·팀 정식명·순위표 팀링크
npm run test:schedule-quality      # 파싱 실패 편성(리그=연도, 팀명에 이벤트명) 색인 차단
npm run test:sitemap-consistency   # 🔴 사이트맵 포함 여부 ↔ 페이지 noindex 일치(슬러그 충돌 228종)
npm run test:team-name-hygiene     # 팀명에 날짜·시간·괄호 조각 유입 차단 + 데이터 전수 스캔
npm run test:autolink              # 가이드 자동 내부링크(한국어 조사 처리 포함)
npm run test:workflow-push         # 🔴 스케줄러 push 재시도 루프가 소진 시 실패하는지(무성 실패 차단)
npm run seo:indexnow     # IndexNow 통지(리그·플랫폼·순위·가이드·팀 86 + /commentary = ~156 URL)
npm run audit:aliases   # 팀명 alias 미스매치 감사 (결과 있는데 스코어 안 뜨는 유형). 개막 후 crawl:results 뒤 실행
npm run news:digest      # 네이버 뉴스 → docs/news-digest.md (NAVER_API_KEY_ID/NAVER_API_KEY 필요)
ISSUE_BODY="$(gh issue view N --json body -q .body)" npm run check:idea-dupes  # 글감 중복 검사
```

## 배포

- **Vercel Git 연동**으로 `main` 푸시 시 자동 프로덕션 배포(`vercel.json` 존재, 별도 deploy 워크플로 없음). 가이드 등 콘텐츠 발행 = main 직접 푸시.
- 데이터 JSON의 `lastUpdated`는 **UTC(Z)** 표기(KST=+9). 로컬 "현재 기준"은 위 crawl 명령으로 재크롤(src/data·public 양쪽 기록).
