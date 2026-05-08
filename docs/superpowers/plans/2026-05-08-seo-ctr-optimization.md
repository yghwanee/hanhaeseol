# SEO CTR 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/league/[slug]` 15개 + `/platform/[slug]` 10개 = 총 25개 동적 페이지의 검색 CTR을 끌어올리기 위해 (1) Title/Description을 호소형으로 재작성하고 (2) SportsEvent JSON-LD 구조화 데이터를 추가한다.

**Architecture:** 새 헬퍼 `src/lib/structured-data.ts`를 만들어 `schedule.json`의 경기 데이터를 schema.org `SportsEvent`로 변환한다. 두 동적 페이지(`league/[slug]/page.tsx`, `platform/[slug]/page.tsx`)에서 해당 페이지에 매칭되는 경기만 필터링해 `<script type="application/ld+json">`으로 삽입한다. 메타 데이터(`src/lib/slugs.ts`)는 호소 키워드("오늘", "LIVE", "한국어 해설")를 포함하도록 일괄 재작성한다.

**Tech Stack:** Next.js 14 App Router, TypeScript, schema.org (SportsEvent / SportsTeam / VirtualLocation)

**Spec:** `docs/superpowers/specs/2026-05-08-seo-ctr-optimization-design.md`

**Out of scope (이 plan에 포함되지 않음):**
- FAQ Schema (이미 `FaqSection.tsx`에 구현됨)
- 페이지 본문 콘텐츠 변경
- OG 이미지 동적 생성
- 메인 페이지 메타
- 백링크 / 외부 권위

---

## 사전 준비

- [ ] **Step 0: 작업 디렉토리 확인**

Run: `git status`
Expected: 작업 트리 깨끗 (clean) 또는 본인 작업물만 있음. 다른 사람 작업물 섞여 있으면 먼저 정리.

---

## Task 1: SportsEvent JSON-LD 빌더 생성

**Files:**
- Create: `src/lib/structured-data.ts`

**의도:** 일정 배열을 받아 schema.org SportsEvent 마크업을 만드는 순수 함수. 종료된 경기는 제외하고 최대 50개까지만 포함한다. 페이지가 비어 있으면 `null`을 반환해 LD 자체를 출력하지 않도록 한다.

- [ ] **Step 1: `src/lib/structured-data.ts` 생성**

```typescript
import type { Schedule } from "@/types/schedule";
import { isGameFinished } from "@/lib/schedule-utils";

const SPORT_SCHEMA_MAP: Record<string, string> = {
  "축구": "Soccer",
  "야구": "Baseball",
  "농구": "Basketball",
  "배구": "Volleyball",
};

const MAX_EVENTS = 50;

/**
 * 경기 일정을 schema.org SportsEvent 배열 JSON-LD로 변환한다.
 * 종료된 경기는 제외, 최대 50개까지만.
 * 출력할 경기가 없으면 null을 반환해 빈 LD가 페이지에 박히지 않도록 한다.
 */
export function buildSportsEventLd(
  schedules: Schedule[],
  pageUrl: string
): string | null {
  const active = schedules
    .filter((s) => !isGameFinished(s.date, s.time, s.sport))
    .slice(0, MAX_EVENTS);

  if (active.length === 0) return null;

  const events = active.map((s) => {
    const [hh, mm] = s.time.split(":");
    const startDate = `${s.date}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00+09:00`;

    return {
      "@type": "SportsEvent",
      name: `${s.homeTeam} vs ${s.awayTeam}`,
      startDate,
      sport: SPORT_SCHEMA_MAP[s.sport] ?? "Sports",
      homeTeam: { "@type": "SportsTeam", name: s.homeTeam },
      awayTeam: { "@type": "SportsTeam", name: s.awayTeam },
      location: {
        "@type": "VirtualLocation",
        url: pageUrl,
      },
      eventStatus: "https://schema.org/EventScheduled",
      broadcastChannel: s.platform,
      inLanguage: s.koreanCommentary === true ? "ko" : "en",
      organizer: {
        "@type": "Organization",
        name: s.league,
      },
    };
  });

  const ld = {
    "@context": "https://schema.org",
    "@graph": events,
  };

  return JSON.stringify(ld);
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. 만약 `Schedule` import 경로가 안 맞으면 `@/types/schedule`이 정확한지 확인.

---

## Task 2: League 페이지에 SportsEvent JSON-LD 삽입

**Files:**
- Modify: `src/app/league/[slug]/page.tsx`

**의도:** 페이지에 해당 리그 경기만 필터링해서 SportsEvent JSON-LD를 추가한다. FilteredScheduleView가 받는 `schedules`는 그대로 전체 배열을 넘기되 (하위 컴포넌트가 알아서 필터링), JSON-LD용으로만 별도 필터링한다.

- [ ] **Step 1: `src/app/league/[slug]/page.tsx` 수정**

기존 import 블록 위에 새 import 추가, default export 함수 본문 수정.

수정 후 전체 파일은 다음과 같이 된다:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LEAGUE_SEO, findLeagueBySlug } from "@/lib/slugs";
import { LEAGUE_GUIDES } from "@/lib/league-guides";
import { LEAGUE_FAQS } from "@/lib/league-faqs";
import { loadScheduleData, loadTeamRecords } from "@/lib/server-data";
import { buildSportsEventLd } from "@/lib/structured-data";
import FilteredScheduleView from "@/app/_components/FilteredScheduleView";
import LeagueGuideSection from "@/app/_components/LeagueGuideSection";
import FaqSection from "@/app/_components/FaqSection";
import WeekHighlights from "@/app/_components/WeekHighlights";

export const revalidate = 600;

export function generateStaticParams() {
  return LEAGUE_SEO.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const meta = findLeagueBySlug(params.slug);
  if (!meta) return {};

  const url = `https://haeseol.com/league/${meta.slug}`;
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: "한해설",
      locale: "ko_KR",
      type: "website",
      images: [{ url: "https://haeseol.com/logo.png", alt: "한해설" }],
    },
    twitter: {
      card: "summary",
      title: meta.title,
      description: meta.description,
    },
  };
}

export default function LeaguePage({ params }: { params: { slug: string } }) {
  const meta = findLeagueBySlug(params.slug);
  if (!meta) notFound();

  const guide = LEAGUE_GUIDES[params.slug];
  const faqs = LEAGUE_FAQS[params.slug];
  const schedules = loadScheduleData().schedules;
  const teamRecords = loadTeamRecords();

  const pageUrl = `https://haeseol.com/league/${meta.slug}`;
  const matched = schedules.filter((s) => meta.match.includes(s.league));
  const sportsEventLd = buildSportsEventLd(matched, pageUrl);

  return (
    <>
      {sportsEventLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: sportsEventLd }}
        />
      )}
      <FilteredScheduleView
        meta={meta}
        kind="league"
        schedules={schedules}
        teamRecords={teamRecords}
        guideSlot={
          guide ? <LeagueGuideSection guide={guide} display={meta.display} /> : undefined
        }
        highlightsSlot={
          <WeekHighlights
            title={`이번 주 ${meta.display} 미리보기`}
            intro={`이번 주 ${meta.display} 한국어 해설 우선 추천 매치업입니다. 매일 자동으로 갱신되며, 종료된 경기는 제외됩니다.`}
            schedules={schedules}
            league={meta.match}
            max={5}
            emptyText={`이번 주 예정된 ${meta.display} 경기가 없습니다.`}
          />
        }
        faqSlot={
          faqs ? (
            <FaqSection title={`${meta.display} 자주 묻는 질문`} faqs={faqs} />
          ) : undefined
        }
      />
    </>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

---

## Task 3: Platform 페이지에 SportsEvent JSON-LD 삽입

**Files:**
- Modify: `src/app/platform/[slug]/page.tsx`

**의도:** Task 2와 동일한 패턴. 단 필터링 키가 `s.league`가 아니라 `s.platform`.

- [ ] **Step 1: `src/app/platform/[slug]/page.tsx` 수정**

수정 후 전체 파일:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PLATFORM_SEO, findPlatformBySlug } from "@/lib/slugs";
import { PLATFORM_GUIDES } from "@/lib/platform-guides";
import { PLATFORM_FAQS } from "@/lib/platform-faqs";
import { loadScheduleData, loadTeamRecords } from "@/lib/server-data";
import { buildSportsEventLd } from "@/lib/structured-data";
import FilteredScheduleView from "@/app/_components/FilteredScheduleView";
import PlatformGuideSection from "@/app/_components/PlatformGuideSection";
import FaqSection from "@/app/_components/FaqSection";
import WeekHighlights from "@/app/_components/WeekHighlights";

export const revalidate = 600;

export function generateStaticParams() {
  return PLATFORM_SEO.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const meta = findPlatformBySlug(params.slug);
  if (!meta) return {};

  const url = `https://haeseol.com/platform/${meta.slug}`;
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: "한해설",
      locale: "ko_KR",
      type: "website",
      images: [{ url: "https://haeseol.com/logo.png", alt: "한해설" }],
    },
    twitter: {
      card: "summary",
      title: meta.title,
      description: meta.description,
    },
  };
}

export default function PlatformPage({ params }: { params: { slug: string } }) {
  const meta = findPlatformBySlug(params.slug);
  if (!meta) notFound();

  const guide = PLATFORM_GUIDES[params.slug];
  const faqs = PLATFORM_FAQS[params.slug];
  const schedules = loadScheduleData().schedules;
  const teamRecords = loadTeamRecords();

  const pageUrl = `https://haeseol.com/platform/${meta.slug}`;
  const matched = schedules.filter((s) => meta.match.includes(s.platform));
  const sportsEventLd = buildSportsEventLd(matched, pageUrl);

  return (
    <>
      {sportsEventLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: sportsEventLd }}
        />
      )}
      <FilteredScheduleView
        meta={meta}
        kind="platform"
        schedules={schedules}
        teamRecords={teamRecords}
        guideSlot={
          guide ? <PlatformGuideSection guide={guide} display={meta.display} /> : undefined
        }
        highlightsSlot={
          <WeekHighlights
            title={`이번 주 ${meta.display} 추천 매치`}
            intro={`이번 주 ${meta.display}에서 시청 가능한 한국어 해설 우선 매치업입니다. 매일 자동으로 갱신됩니다.`}
            schedules={schedules}
            platform={meta.match}
            max={5}
            emptyText={`이번 주 예정된 ${meta.display} 중계가 없습니다.`}
          />
        }
        faqSlot={
          faqs ? (
            <FaqSection title={`${meta.display} 자주 묻는 질문`} faqs={faqs} />
          ) : undefined
        }
      />
    </>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

---

## Task 4: LEAGUE_SEO 15개 항목 메타 재작성

**Files:**
- Modify: `src/lib/slugs.ts` (LEAGUE_SEO 배열, 13~177번 라인 부근)

**의도:** Title은 60~70자 내외로 호소 키워드("오늘", "LIVE", "한국어 해설") 포함. Description은 130~160자, 검색 스니펫을 가득 채움. `slug`, `match`, `display`, `sport`, `keywords`, `intro`는 그대로 유지.

- [ ] **Step 1: 15개 항목의 `title`과 `description`만 아래 표대로 교체**

각 항목별로 `title:`과 `description:` 라인만 교체한다 (다른 필드는 손대지 않음).

| slug | 새 title | 새 description |
|---|---|---|
| epl | `EPL 중계 편성표 — 오늘 프리미어리그 한국어 해설 일정 \| 한해설` | `프리미어리그(EPL) 한국어 해설 중계 편성표. 맨유·리버풀·첼시·아스날 등 EPL 경기 일정과 한국어 해설 여부를 오늘부터 7일치 한눈에 확인하세요.` |
| laliga | `라리가 중계 편성표 — 오늘 레알·바르샤 한국어 해설 일정 \| 한해설` | `라리가(스페인 프리메라) 한국어 해설 중계 편성표. 레알 마드리드·바르셀로나·아틀레티코 등 엘 클라시코 포함 한국어 중계 일정을 오늘부터 7일치 확인하세요.` |
| bundesliga | `분데스리가 중계 편성표 — 오늘 바이에른·김민재 한국어 해설 \| 한해설` | `분데스리가 한국어 해설 중계 편성표. 바이에른 뮌헨(김민재)·도르트문트 등 독일 1부 경기 일정과 한국어 해설 여부를 오늘부터 7일치 확인하세요.` |
| seriea | `세리에A 중계 편성표 — 오늘 유벤투스·밀란 한국어 해설 \| 한해설` | `세리에A(이탈리아 1부) 한국어 해설 중계 편성표. 유벤투스·AC 밀란·인터·나폴리 등 빅매치 일정과 한국어 해설 여부를 오늘부터 7일치 확인하세요.` |
| ligue1 | `리그 1 중계 편성표 — 오늘 PSG·이강인 한국어 해설 \| 한해설` | `프랑스 리그 1 한국어 해설 중계 편성표. PSG(이강인)·마르세유·모나코 등 경기 일정과 한국어 해설 여부를 오늘부터 7일치 확인하세요.` |
| champions-league | `챔피언스리그 중계 편성표 — 오늘 UCL 한국어 해설 일정 \| 한해설` | `UEFA 챔피언스리그(UCL) 한국어 해설 중계 편성표. 유럽 최고의 클럽 대항전 경기 일정과 한국어 해설 여부를 오늘부터 7일치 확인하세요.` |
| europa-league | `유로파리그 중계 편성표 — 오늘 UEL 한국어 해설 일정 \| 한해설` | `UEFA 유로파리그(UEL) 한국어 해설 중계 편성표. 유럽 클럽 대항전 경기 일정과 한국어 해설 여부를 오늘부터 7일치 확인하세요.` |
| conference-league | `컨퍼런스리그 중계 편성표 — 오늘 UECL 한국어 해설 \| 한해설` | `UEFA 컨퍼런스리그(UECL) 한국어 해설 중계 편성표. 유럽 클럽 대항전 경기 일정과 한국어 해설 여부를 오늘부터 7일치 확인하세요.` |
| mls | `MLS 중계 편성표 — 오늘 메시·인터마이애미 한국어 해설 \| 한해설` | `MLS(미국 메이저 리그 사커) 한국어 해설 중계 편성표. 메시가 뛰는 인터 마이애미·LA 갤럭시 등 경기 일정을 오늘부터 7일치 확인하세요.` |
| k-league-1 | `K리그1 중계 편성표 — 오늘 한국 프로축구 1부 LIVE 일정 \| 한해설` | `K리그1(한국 프로축구 1부) 중계 편성표. 울산·전북·포항 등 K리그1 전 경기 LIVE 중계 일정을 오늘부터 7일치 한눈에 확인하세요.` |
| k-league-2 | `K리그2 중계 편성표 — 오늘 한국 프로축구 2부 LIVE 일정 \| 한해설` | `K리그2(한국 프로축구 2부) 중계 편성표. K리그2 전 경기 LIVE 중계 일정과 채널을 오늘부터 7일치 한눈에 확인하세요.` |
| afc-champions-league | `AFC 챔피언스리그 중계 편성표 — 오늘 ACL 한국어 해설 \| 한해설` | `AFC 챔피언스리그 엘리트/2 한국어 해설 중계 편성표. K리그 팀들이 출전하는 아시아 클럽 대항전 일정과 한국어 해설 여부를 오늘부터 7일치 확인하세요.` |
| mlb | `MLB 중계 편성표 — 오늘 메이저리그 한국어 해설 LIVE 일정 \| 한해설` | `MLB(메이저리그) 한국어 해설 중계 편성표. 다저스·양키스·김하성 등 경기 일정과 한국어 해설 여부를 오늘부터 7일치 한눈에 확인하세요.` |
| kbo | `KBO 중계 편성표 — 오늘 한국 프로야구 LIVE 일정 \| 한해설` | `KBO(한국 프로야구) 중계 편성표. 두산·LG·KIA·키움 등 KBO 전 경기 LIVE 중계 일정과 채널을 오늘부터 7일치 한눈에 확인하세요.` |
| kbl | `KBL 중계 편성표 — 오늘 한국 프로농구 LIVE 일정 \| 한해설` | `KBL(한국 프로농구) 중계 편성표. KBL 전 경기 LIVE 중계 일정과 채널을 오늘부터 7일치 한눈에 확인하세요.` |

위 표가 LEAGUE_SEO의 15개 슬러그 전체임. `src/lib/slugs.ts`에서 각 슬러그를 찾아 `title:` / `description:` 라인만 위 값으로 교체.

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: lint**

Run: `npm run lint`
Expected: 에러/경고 없음.

---

## Task 5: PLATFORM_SEO 10개 항목 메타 재작성

**Files:**
- Modify: `src/lib/slugs.ts` (PLATFORM_SEO 배열, 179~272번 라인 부근)

**의도:** Task 4와 동일 원칙. 플랫폼은 "LIVE 중계", "한국어 해설 표시" 키워드 강조.

- [ ] **Step 1: 10개 항목의 `title`과 `description`만 아래 표대로 교체**

| slug | 새 title | 새 description |
|---|---|---|
| spotv-now | `SPOTV NOW 편성표 — 오늘 LIVE 중계 + 한국어 해설 표시 \| 한해설` | `SPOTV NOW(스포티비 나우) 한국어 해설 중계 편성표. EPL·MLB·UFC 등 LIVE 일정을 한국어 해설 여부와 함께 오늘부터 7일치 확인하세요.` |
| coupang-play | `쿠팡플레이 편성표 — 오늘 스포츠 LIVE + 한국어 해설 표시 \| 한해설` | `쿠팡플레이 스포츠 중계 편성표. K리그·MLB·NFL·F1 등 쿠팡플레이 LIVE 중계 일정을 한국어 해설 여부와 함께 오늘부터 7일치 확인하세요.` |
| tving | `티빙 스포츠 편성표 — 오늘 KBO·KBL LIVE 중계 일정 \| 한해설` | `티빙(TVING) 스포츠 중계 편성표. KBO 디지털 독점·KBL 등 티빙 LIVE 중계 일정을 오늘부터 7일치 한눈에 확인하세요.` |
| apple-tv | `Apple TV+ 스포츠 편성표 — 오늘 MLS LIVE 중계 일정 \| 한해설` | `Apple TV+ 스포츠 중계 편성표. MLS Season Pass(메시 인터 마이애미 등) LIVE 중계 일정을 오늘부터 7일치 확인하세요. (현지 해설 제공)` |
| spotv | `SPOTV 편성표 — 오늘 LIVE 중계 + 한국어 해설 표시 \| 한해설` | `SPOTV TV 채널 LIVE 중계 편성표. EPL·MLB·테니스 등 SPOTV 채널의 한국어 해설 여부와 함께 오늘부터 7일치 일정을 확인하세요.` |
| spotv2 | `SPOTV2 편성표 — 오늘 LIVE 중계 + 한국어 해설 표시 \| 한해설` | `SPOTV2 TV 채널 LIVE 중계 편성표. 세리에A·해외축구·MLB 등 SPOTV2 채널의 한국어 해설 여부와 함께 오늘부터 7일치 일정을 확인하세요.` |
| tvn-sports | `tvN SPORTS 편성표 — 오늘 LIVE 중계 + 한국어 해설 \| 한해설` | `tvN SPORTS 채널 LIVE 중계 편성표. EPL·KBO·ATP 테니스 등 한국어 해설 일정을 오늘부터 7일치 한눈에 확인하세요.` |
| kbs-n-sports | `KBS N SPORTS 편성표 — 오늘 LIVE 중계 + 한국어 해설 \| 한해설` | `KBS N SPORTS 채널 LIVE 중계 편성표. KBO·프로배구 등 한국어 해설 일정을 오늘부터 7일치 한눈에 확인하세요.` |
| mbc-sports-plus | `MBC SPORTS+ 편성표 — 오늘 LIVE 중계 + 한국어 해설 \| 한해설` | `MBC SPORTS+ 채널 LIVE 중계 편성표. KBO·프로축구 등 한국어 해설 일정을 오늘부터 7일치 한눈에 확인하세요.` |
| sbs-sports | `SBS Sports 편성표 — 오늘 LIVE 중계 + 한국어 해설 \| 한해설` | `SBS Sports 채널 LIVE 중계 편성표. KBO·프로농구 등 한국어 해설 일정을 오늘부터 7일치 한눈에 확인하세요.` |

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: lint**

Run: `npm run lint`
Expected: 에러/경고 없음.

---

## Task 6: 빌드 + 로컬 검증

**Files:** (코드 변경 없음, 검증만)

**의도:** 변경된 페이지가 빌드되고, 실제 HTML에 SportsEvent JSON-LD가 잘 박히는지 직접 확인. dev 서버에서 5개 대표 페이지의 메타 + ld+json을 검증.

- [ ] **Step 1: 풀 빌드**

Run: `npm run build`
Expected: 빌드 성공. `Generating static pages (N/N)` 메시지에서 league/platform 페이지가 모두 생성되어야 함. 에러/워닝 발생 시 진행 중단하고 디버깅.

- [ ] **Step 2: dev 서버 실행 (백그라운드)**

Run: `npm run dev`
백그라운드 실행. 서버가 `http://localhost:3000`에 뜰 때까지 대기.

- [ ] **Step 3: 5개 대표 페이지 메타 + JSON-LD 점검**

다음 페이지 5개에 대해 HTML 응답에서 ① 새 title이 들어가 있는지 ② SportsEvent ld+json 블록이 있는지 확인.

대상 페이지:
- `/league/epl`
- `/league/mlb`
- `/platform/coupang-play`
- `/platform/spotv2`
- `/platform/sbs-sports`

각각 다음 명령으로 확인:

```bash
curl -s http://localhost:3000/league/epl | grep -E '<title>|SportsEvent'
```

Expected (예시 — `/league/epl`):
- `<title>EPL 중계 편성표 — 오늘 프리미어리그 한국어 해설 일정 | 한해설</title>` 라인 출력
- `"@type":"SportsEvent"` 가 포함된 ld+json 블록 출력

만약 `SportsEvent`가 안 나온다면 → 해당 리그/플랫폼에 활성 경기가 없거나 (정상), `loadScheduleData()`가 실패한 것 (오류).

- [ ] **Step 4: dev 서버 종료**

백그라운드 dev 프로세스 종료.

- [ ] **Step 5: 변경 요약 작성**

`git status`로 변경된 파일 확인:
- `src/lib/structured-data.ts` (신규)
- `src/app/league/[slug]/page.tsx` (수정)
- `src/app/platform/[slug]/page.tsx` (수정)
- `src/lib/slugs.ts` (수정)
- `docs/superpowers/specs/2026-05-08-seo-ctr-optimization-design.md` (이번 작업에서 작성)
- `docs/superpowers/plans/2026-05-08-seo-ctr-optimization.md` (이번 작업에서 작성)

사용자에게 변경 파일 목록 + 검증 결과 요약 보고. **commit은 사용자가 명시적으로 요청할 때만 진행** (시스템 정책).

---

## 배포 후 검증 (이 plan 외)

이 plan은 코드 변경까지만 다룸. 배포 후 외부 검증:

1. Vercel 프로덕션 배포 확인
2. Google Rich Results Test (`https://search.google.com/test/rich-results`)에서 5개 대표 URL 검증
3. Google Search Console에서 색인 재요청 (선택)
4. 28일 후 Search Console 실적 비교 (CTR / 노출 / 클릭)
