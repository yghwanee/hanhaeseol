# 한해설 (HanHaesul) - 스포츠 중계 편성표 서비스

## 프로젝트 개요

여러 스포츠 중계 플랫폼의 편성표를 한곳에 모아 보여주는 웹 서비스.
**핵심 기능**: 각 경기의 [한국어해설] 여부를 명확하게 표시하여, 사용자가 한국어 해설이 있는 중계를 쉽게 찾을 수 있도록 한다.

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Directory**: `src/` 디렉토리 구조 사용
- **자동화**: GitHub Actions (하루 5회 크롤링)

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
│       ├── index.ts         # 크롤러 통�� + 필터링
│       ├── parsers.ts       # 제목 파싱, 리그명 정규화, 종목 감지
│       ├── spotv-now.ts     # SPOTV NOW API 크롤러
│       ├── spotv-tv.ts      # SPOTV/SPOTV2 TV 채널 크롤러
│       ├── mbc-sports.ts    # MBC SPORTS+ 크롤러
│       ├── tvn-sports.ts    # tvN SPORTS 크롤러
│       ├── sbs-sports.ts    # SBS Sports 크롤러
│       └── kbs-sports.ts    # KBS N SPORTS 크롤러
├── scripts/
│   └── crawl.ts             # 크롤링 실행 스크립트
└── types/
    └── schedule.ts          # Schedule, ScheduleData, Sport, Platform 타입
```

## 플랫폼 (10개)

| 구분 | 플랫폼 | 크롤러 상태 |
|------|--------|------------|
| OTT | SPOTV NOW | 구현 완료 (API, 한국어해설 자동 판별) |
| OTT | 쿠팡플레이 | 미구현 (403 차단) |
| OTT | 티빙 | 미구현 (로그인 필요) |
| OTT | Apple TV+ | 미구현 (비공개 API) |
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
- GitHub Actions: KST 01:07, 05:07, 11:07, 17:07, 22:07 자동 실행 (정각 회피)
- 비경��� 콘텐츠(하이라이트, 시상식, 스포타임 등) 자�� 제외
- SPOTV TV는 LIVE만 수집 (녹화 본방송 제외)

## 작업 진행 상황

### 완료된 작업
1. 프로젝트 초기 설정 (Next.js 14 + TypeScript + Tailwind CSS)
2. 타입 정의 (Sport, Platform, Schedule, ScheduleData)
3. 메인 페이지 UI (필���링, 경기 카드, 다크모드, 반응형)
4. 크롤러 6개 구현 (SPOTV NOW, SPOTV/SPOTV2, MBC SPORTS+, tvN SPORTS, SBS Sports, KBS N SPORTS)
5. 리그명/팀명 파싱 정규화
6. 경기 종료 표시 (종목별 예상 ��간)
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

### 다음 작업 (예정)
- 쿠팡플레이, 티빙 크롤러 (Playwright 또는 API 분석 필요)
- Apple TV+ 크롤러
- Vercel 배포 설정

## 개발 명령어

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버
npm run lint     # ESLint 검사
npm run crawl    # 크롤링 실행 (7일치)
```
