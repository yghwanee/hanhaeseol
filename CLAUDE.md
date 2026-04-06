# 한해설 (HanHaesul) - 스포츠 중계 편성표 서비스

## 프로젝트 개요

여러 스포츠 중계 플랫폼(SPOTV, 쿠팡플레이, 티빙 등)의 편성표를 한곳에 모아 보여주는 웹 서비스.
**핵심 기능**: 각 경기의 [한국어해설] 여부를 명확하게 표시하여, 사용자가 한국어 해설이 있는 중계를 쉽게 찾을 수 있도록 한다.

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Directory**: `src/` 디렉토리 구조 사용

## 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx       # 루트 레이아웃 (다크모드 기본, lang="ko")
│   ├── page.tsx         # 메인 페이지 (클라이언트 컴포넌트)
│   ├── globals.css      # 글로벌 스타일
│   └── fonts/           # Geist 폰트
├── data/
│   └── schedule.json    # 경기 편성 데이터 (빌드타임 import)
└── types/
    └── schedule.ts      # Schedule, ScheduleData 타입 정의
```

## 주요 도메인 개념

- **플랫폼(Platform)**: 중계를 제공하는 서비스 (SPOTV, 쿠팡플레이, 티빙 등)
- **경기(Match)**: 스포츠 경기 정보 (종목, 팀, 시간 등)
- **편성(Schedule)**: 특정 플랫폼에서 특정 경기를 중계하는 일정
- **한국어해설(Korean Commentary)**: `true`(한국어해설) / `false`(현지해설) / `"unknown"`(확인중)

## 메인 페이지 기능

- **날짜 탭**: 이번 주 월~일, 오늘 날짜 기본 선택
- **필터**: 종목(전체/축구/야구), 플랫폼(전체/SPOTV/쿠팡플레이/티빙), 해설(전체/한국어해설만)
- **경기 카드**: 시간, 리그, 홈 VS 원정, 플랫폼 뱃지, 한국어해설 뱃지
- **한국어해설 뱃지**: 초록(한국어해설) / 회색(현지해설) / 노란(확인중)
- 모바일 퍼스트 반응형, 다크모드 기본

## 데이터

- `src/data/schedule.json`에서 빌드타임에 import (fetch 아님)
- 데이터 수정 시 `schedule.json` 직접 편집

## 작업 진행 상황

### 완료된 작업
1. **프로젝트 초기 설정** - Next.js 14 + TypeScript + Tailwind CSS 기반 프로젝트 생성
2. **타입 정의** - `Schedule`, `ScheduleData` 타입 정의 (`src/types/schedule.ts`)
3. **샘플 데이터** - 경기 편성 데이터 JSON 구성 (`src/data/schedule.json`)
4. **메인 페이지 구현** - 편성표 필터링 및 경기 카드 UI 완성 (`src/app/page.tsx`)
   - 날짜 탭 (이번 주 월~일, 오늘 기본 선택)
   - 종목/플랫폼/해설 필터
   - 경기 카드 (시간, 리그, 팀, 플랫폼 뱃지, 한국어해설 뱃지)
   - 다크모드 기본, 모바일 퍼스트 반응형 디자인

### 다음 작업 (예정)
- 실제 편성 데이터 수집/업데이트 방식 결정
- 플랫폼별 크롤링 또는 API 연동
- 배포 설정

## 개발 명령어

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버
npm run lint     # ESLint 검사
```
