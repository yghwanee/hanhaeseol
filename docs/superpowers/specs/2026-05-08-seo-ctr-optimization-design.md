# SEO CTR 개선 설계

작성일: 2026-05-08
대상: `/league/[slug]` 15개 + `/platform/[slug]` 10개 = 총 25개 동적 페이지

## 배경

Search Console 3개월 데이터 분석 결과:

- 페이지 분리는 이미 완료되어 있고, 노출도 나오고 있음 (메인 흡수 가설은 틀림)
- 진짜 문제는 **노출 대비 CTR이 낮음**
- 예: `/platform/sbs-sports` 54노출/1클릭 (1.9%), `/platform/tvn-sports` 36노출/0클릭 (0%)
- 또한 EPL·챔스·라리가 등 핵심 키워드 페이지는 노출 자체가 거의 없음

## 목표

검색 결과 스니펫의 클릭 유도력을 높이고, 구글이 페이지를 더 정확하게 이해하도록 구조화 데이터를 강화한다.

**성공 기준:**
- 28일 후 Search Console 기준 평균 CTR이 현재 8.4% → 12% 이상
- 대상 페이지 중 "노출 30+ & CTR 5% 미만" 페이지 수를 절반 이하로 감소
- Rich Results Test에서 SportsEvent / FAQPage 마크업이 유효하게 인식

## 변경 사항

### 1. Title / Description 호소형으로 개편

**파일:** `src/lib/slugs.ts` 의 `LEAGUE_SEO`, `PLATFORM_SEO` 모든 항목

**원칙:**
- Title 60자 내외, "오늘", "LIVE", "한국어 해설" 같은 호소 키워드 포함
- Description 130~160자, 검색 스니펫을 가득 채우고 가치 제안 명확화

**예시 (SPOTV2):**

| 항목 | 현재 | 개편 |
|---|---|---|
| Title | `SPOTV2 편성표 \| 스포티비2 TV 채널 - 한해설` | `SPOTV2 편성표 — 오늘 LIVE 중계 + 한국어 해설 표시 \| 한해설` |
| Description | `SPOTV2 TV 채널 편성표. 라이브 스포츠 중계 일정.` | `SPOTV2 LIVE 중계 편성표를 한국어 해설 여부와 함께 정리. EPL·MLB 등 오늘부터 7일치 일정을 시간순으로 확인하세요.` |

**예시 (EPL):**

| 항목 | 현재 | 개편 |
|---|---|---|
| Title | `EPL 중계 편성표 \| 프리미어리그 한국어 해설 일정 - 한해설` | `EPL 중계 편성표 — 오늘 프리미어리그 한국어 해설 일정 \| 한해설` |
| Description | `프리미어리그(EPL) 중계 편성표. 맨체스터 유나이티드, 리버풀, 첼시, 아스널 등 주요 경기의 한국어 해설 중계 일정을 확인하세요.` | (현재 적절. 130자 근처라 유지) |

### 2. SportsEvent JSON-LD 추가

**위치:** `src/app/league/[slug]/page.tsx`, `src/app/platform/[slug]/page.tsx`

**구현:**
- 새 헬퍼 `src/lib/structured-data.ts` 생성
- 각 페이지에서 `meta.match`로 필터링한 7일치 경기 → `SportsEvent` 배열 생성
- `<script type="application/ld+json">` 태그로 페이지에 삽입
- 최대 50경기 (구글 권장 한계 + 페이지 무게 제한)

**스키마 구조 (경기 1개당):**

```json
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "리버풀 vs 맨체스터 시티",
  "startDate": "2026-05-12T20:30:00+09:00",
  "sport": "Soccer",
  "homeTeam": { "@type": "SportsTeam", "name": "리버풀" },
  "awayTeam": { "@type": "SportsTeam", "name": "맨체스터 시티" },
  "location": {
    "@type": "VirtualLocation",
    "url": "https://haeseol.com/platform/coupang-play"
  },
  "eventStatus": "https://schema.org/EventScheduled",
  "broadcastChannel": "쿠팡플레이",
  "inLanguage": "ko"
}
```

**Sport 매핑:** `축구 → Soccer`, `야구 → Baseball`, `농구 → Basketball`, `배구 → Volleyball`

**경기 종료 처리:** 종료된 경기는 제외 (페이지 로드 시점 기준).

### 3. FAQ Schema — 이미 구현 완료

`src/app/_components/FaqSection.tsx`에 `FAQPage` JSON-LD가 이미 박혀 있음 (코드 검토로 확인). 별도 작업 불필요. 단, 빌드 후 Rich Results Test로 유효성만 재확인한다.

## 변경하지 않는 것

- 페이지 본문 콘텐츠 (B 단계)
- OG 이미지 (B 단계)
- 백링크/외부 권위 (C 단계)
- 메인 페이지 메타 (`src/app/layout.tsx`) — 별도 최적화 필요 시 다음 작업
- 기존 `WebSite`, `Organization` JSON-LD (이미 layout.tsx에 있음)

## 아키텍처

```
src/lib/structured-data.ts  (신규)
  ├─ buildSportsEventLd(schedules, baseUrl)
  ├─ buildFaqLd(faqs)
  └─ SPORT_SCHEMA_MAP

src/app/league/[slug]/page.tsx  (수정)
  └─ <script ld+json> 두 개 삽입 (SportsEvent, FAQPage)

src/app/platform/[slug]/page.tsx  (수정)
  └─ <script ld+json> 두 개 삽입 (SportsEvent, FAQPage)

src/lib/slugs.ts  (수정)
  └─ LEAGUE_SEO, PLATFORM_SEO 항목별 title/description 재작성
```

## 위험 / 주의사항

- **Description 너무 자주 바꾸면 구글 신뢰 저하** — 정적 텍스트로 작성, 동적 요소는 JSON-LD에만 박는다.
- **JSON-LD 마크업 오류 시 SEO 역효과** — 빌드 후 Google Rich Results Test로 모든 페이지 검증.
- **경기 데이터가 비어 있는 페이지** — 빈 SportsEvent 배열은 LD 자체를 출력하지 않음 (스팸 방지).
- **`schedule.json` 외 데이터 변경 시 캐싱** — 페이지 `revalidate = 600` 이미 설정됨, JSON-LD도 같은 주기로 갱신됨.

## 검증

1. `npm run build` — 빌드 통과
2. 로컬에서 5개 대표 페이지 (`epl`, `mlb`, `coupang-play`, `spotv2`, `sbs-sports`) HTML 소스에서 ld+json 확인
3. 빌드 후 Vercel 배포 → Google Rich Results Test 통과 확인
4. 28일 후 Search Console에서 CTR 변화 측정
