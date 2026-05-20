# AI 관전 포인트 (Match Insights) 설계

작성일: 2026-05-20
상태: Draft — 사용자 리뷰 대기

## Overview

한해설의 각 경기 상세 페이지(`/match/[slug]`)에 **AI가 생성한 관전 포인트 글**을 자동으로 붙인다.
베팅·픽·확률은 일절 다루지 않고, "이 경기를 보는 재미"를 600-1000자 분량의 분석 아티클로 제공한다.

**수익화 목표**: SEO 트래픽 증가 → AdSense 임프레션 + 쿠팡 파트너스 노출 증가.
**자본 원칙**: 0원 유지 (Gemini 2.0 Flash 무료 티어 활용).

## Goals

- 한국어 해설이 있는 모든 경기에 대해 매일 새벽 자동으로 관전 포인트 글 생성
- `/match/[slug]` 페이지의 SEO·체류시간 향상
- 베팅·도박 색이 0인 콘텐츠 → AdSense 안전
- 비용 0원 유지

## Non-Goals

- 베팅 픽, 승률 예측, 배당 분석 (영구히 안 함 — AdSense 정책 위험)
- 한국어 해설 없는 경기는 대상 외
- 실시간 라이브 분석 (생성은 1일 1회 사전 일괄)
- 사용자 댓글·커뮤니티 기능

## Architecture

```
[06:00 KST] GitHub Actions: generate-match-insights.yml
   │
   ├─ schedule.json 로드 → 향후 3일치 한국어 해설 경기 추출
   │
   ├─ 각 경기마다:
   │    1. context 빌드 (한해설 자체 데이터)
   │       ├─ 양 팀 현재 순위
   │       ├─ 양 팀 최근 5경기 결과
   │       ├─ 상대전적 (있는 경우)
   │       └─ schedule 메타 (리그/시간/플랫폼)
   │    2. Gemini 2.0 Flash 호출 (Google Search grounding ON)
   │    3. 후처리: 베팅 단어 정규식 필터, 길이 검증
   │    4. src/data/match-insights/{matchId}.json 저장
   │
   ├─ 실패 경기는 silent skip (전체 잡 안 죽음)
   │
   └─ git commit + push → Vercel 자동 재배포
```

**런타임 (Next.js)**:
- `/match/[slug]` 서버 컴포넌트에서 `src/data/match-insights/{matchId}.json` 읽음
- 파일 없으면 인사이트 섹션 자체 비표시 (폴백 텍스트 없음)
- `<article>` + schema.org `Article` JSON-LD 주입

**스택**:
- AI: Google Gemini 2.0 Flash (무료 티어, Search grounding 포함)
- 트리거: GitHub Actions cron + `workflow_dispatch` (모바일에서 수동 가능)
- 저장소: git 안에 JSON 파일 (기존 schedule.json 패턴 그대로)
- 렌더링: Next.js SSG/ISR

## Data Model

`src/data/match-insights/{matchId}.json`:

```json
{
  "matchId": "epl-2026-05-21-mancity-arsenal",
  "generatedAt": "2026-05-20T06:00:00+09:00",
  "model": "gemini-2.0-flash",
  "sections": {
    "headline": "리그 1-2위 격돌, 우승 향방 가른다",
    "recentForm": "맨시티는 최근 5경기 4승1무. 홈 평균 2.4골...",
    "keyMatchup": "홀란드 vs 더브른 — 올 시즌 더브른이...",
    "watchPoints": [
      "세트피스 상황 (양 팀 리그 1·2위)",
      "맨시티 프레싱 강도",
      "아스널 빠른 역습 빈도"
    ],
    "viewingInfo": "한국어 해설 — SPOTV NOW · 22:30 킥오프"
  }
}
```

`matchId`는 기존 `Schedule.id` 와 동일 키 사용 (재발명 안 함).

## Prompt Strategy

Gemini에게 주는 프롬프트는 다음 골격으로 고정:

```
당신은 한국 축구 팬을 위한 관전 가이드 작성자입니다.
픽/배당/베팅·승률·예측에 대한 언급은 절대 하지 않습니다.

[경기 정보]
- 리그: {league}
- 홈팀: {home} (현재 {homeRank}위, 최근 5경기 {homeRecent})
- 원정팀: {away} (현재 {awayRank}위, 최근 5경기 {awayRecent})
- 상대전적: {h2h}
- 한국 시간 킥오프: {kickoff}
- 한국어 해설 플랫폼: {platform}

[작성 규칙]
- 600-1000자
- JSON 형식으로 반환 (headline, recentForm, keyMatchup, watchPoints[], viewingInfo)
- 베팅·확률·예측·배당·픽·승률 단어 금지
- "관전 포인트", "보는 재미", "주목할 부분" 중심
- 부상자/라인업은 Google Search로 확인. 확실하지 않으면 생략.
```

## Safety: 베팅 회피 = AdSense 안전장치

1. **프롬프트 레벨**: "베팅/확률/예측 금지" 명시
2. **후처리 정규식 필터**: 출력에 `배당|픽|승률|적중|꽁머니|토토|승패예측` 검출 시 그 경기 폐기
3. **길이 검증**: 출력 < 300자 = 데이터 부족 판단, 스킵
4. **글 하단 footer**: `"AI 보조 작성 · 베팅 추천 아님 · 한국어 해설 안내 목적"`
5. **기존 `/analysis` (해외 픽스터 분석글)**: 영구 noindex 유지

## UI Changes

### `/match/[slug]` 페이지

기존 구조에 인사이트 섹션을 다음 위치에 삽입:

```
- 헤더 (← 편성표로)
- 경기 헤드라인 (팀명/리그/시간/플랫폼)
- 쿠팡 상단 배너 (기존)
- [신규] ✨ AI 관전 포인트 섹션
  ├─ headline (h2)
  ├─ recentForm
  ├─ keyMatchup
  ├─ [신규] AdSense 인-아티클 광고
  ├─ watchPoints (불릿 리스트)
  ├─ viewingInfo
  └─ footer ("AI 보조 작성 · 베팅 추천 아님")
- 양팀 최근 5경기 (기존)
- 양팀 시즌 순위 (기존)
- AdSense 하단 (기존)
```

인사이트 JSON 부재 시 신규 섹션 전체 비표시.

### 메인 편성표 — 경기 카드 클릭 가능화

- 현재 카드 = 클릭 인터랙션 없음 → `<Link href="/match/{slug}">` 으로 카드 전체 감쌈
- hover 시 caps-stripe 강조 + cursor pointer
- 카드 안 별★/플랫폼 뱃지 클릭은 `stopPropagation`으로 별도 동작 유지

### SEO JSON-LD

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{insight.headline}",
  "datePublished": "{insight.generatedAt}",
  "author": { "@type": "Organization", "name": "한해설" },
  "about": [{ "@type": "SportsEvent", "name": "{home} vs {away}" }]
}
```

페이지 `<title>` / `<meta description>`도 인사이트 headline 기반 동적 생성.

## Error Handling

| 실패 유형 | 동작 |
|----------|------|
| Gemini API 호출 실패 | 그 경기 skip, 로그 기록, 다음 경기 진행 |
| 출력에 베팅 단어 검출 | 결과 폐기, 1회 재시도, 또 걸리면 skip |
| 출력 길이 < 300자 | 데이터 부족 판단, skip |
| JSON 파싱 실패 | skip |

**원칙**: 실패는 silent skip. 폴백 텍스트("AI가 답을 못 했어요" 등) 절대 생성하지 않음.
인사이트 없으면 섹션 자체가 안 보이게 한다.

## Phased Rollout

```
Phase 1 (1주차): EPL만, robots noindex
  └─ /match/[slug]에 인사이트 노출, 검색 노출은 차단
  └─ 운영자가 직접 글 품질 검수

Phase 2 (2주차): EPL + KBO + MLB, noindex 유지
  └─ 베팅 단어 검출 0건 확인되면 다음 단계로

Phase 3 (3주차~): 전 종목, robots index ON, sitemap 갱신
  └─ 새 콘텐츠 풍부해진 시점에 AdSense 재심사 재신청
```

## Monitoring

- GitHub Actions 결과 → 텔레그램 알림 (기존 인프라 재사용)
  - 예: `"오늘 67/72 경기 인사이트 생성 완료. 실패 5건. 베팅 단어 폐기 0건."`
- 운영자용 `/admin/insights` 페이지: 일별 생성 카운트 / 실패 카운트 / 평균 길이
- Gemini 무료 티어 카운터: 일일 호출 수 로깅. 1,500 req/day 80% 도달 시 텔레그램 경고.

## Cost

| 항목 | 비용 |
|------|------|
| GitHub Actions (public repo) | 0원 |
| Gemini 2.0 Flash 무료 티어 | 0원 (일 1,500 req, 한해설 일 평균 30-80경기) |
| Vercel 배포 | 0원 (기존 무료 플랜) |
| **합계** | **0원** |

## Future Options (Out of Scope)

- 빅매치 글을 사용자가 로컬 Claude Code (Max 구독, Opus 4.7)로 다시 써서 덮어쓰는 큐레이션 워크플로우
- 텔레그램 채널에 매일 "오늘의 빅매치 관전 포인트" 자동 발행
- TikTok 자동 게시 인프라(이미 완비)와 연동해 짧은 영상 자동 생성
- 영어 번역본 (글로벌 SEO)

## Phase 1 검수 항목

Phase 1 운영 중 다음을 관찰해 Phase 2 진입 전에 조정한다:

- 3일치 생성 범위가 적절한가, 7일치로 늘릴 가치가 있는가
- Gemini Search grounding의 한국 축구 부상/라인업 데이터 품질
- `/admin/insights` 운영자용 페이지가 실제로 필요한가, 텔레그램 알림만으로 충분한가
